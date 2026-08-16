const crypto = require("crypto");
const pool = require("../config/database");

/**
 * Utility to sleep for a given number of milliseconds.
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Log a webhook delivery attempt in webhook_delivery_log table.
 */
const logWebhookAttempt = async ({
    notificationId,
    customerId,
    webhookUrl,
    payload,
    attemptNumber,
    status,
    responseCode = null,
    responseBody = null,
    errorMessage = null,
    durationMs = null
}) => {
    try {
        await pool.query(
            `
            INSERT INTO webhook_delivery_log (
                notification_id,
                customer_id,
                webhook_url,
                payload,
                attempt_number,
                status,
                response_code,
                response_body,
                error_message,
                duration_ms,
                created_at
            )
            VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
            `,
            [
                notificationId || null,
                customerId,
                webhookUrl,
                JSON.stringify(payload),
                attemptNumber,
                status,
                responseCode,
                responseBody ? String(responseBody).slice(0, 1000) : null,
                errorMessage ? String(errorMessage).slice(0, 1000) : null,
                durationMs
            ]
        );
    } catch (err) {
        console.error("[WebhookService] Failed to record delivery log:", err.message);
    }
};

/**
 * Send a notification payload to a customer's registered webhook URL with retry & exponential backoff.
 */
const sendWebhookNotification = async ({
    webhookUrl,
    webhookSecret = null,
    notification,
    customerId,
    maxAttempts = 3
}) => {
    if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.startsWith("http")) {
        console.warn(`[WebhookService] Invalid webhook URL: ${webhookUrl}`);
        return { success: false, reason: "Invalid webhook URL" };
    }

    const payload = {
        event: "notification.created",
        timestamp: new Date().toISOString(),
        data: {
            notification_id: notification.id,
            shipment_id: notification.shipment_id,
            customer_id: customerId,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            priority: notification.priority,
            channel: notification.channel,
            created_at: notification.created_at
        }
    };

    const payloadString = JSON.stringify(payload);
    const headers = {
        "Content-Type": "application/json",
        "User-Agent": "SupplyChain-Webhook-Dispatcher/1.0"
    };

    // Add HMAC-SHA256 signature if secret is provided
    if (webhookSecret) {
        const signature = crypto
            .createHmac("sha256", webhookSecret)
            .update(payloadString)
            .digest("hex");
        headers["X-Hub-Signature"] = `sha256=${signature}`;
    }

    let finalSuccess = false;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const startTime = Date.now();
        let responseCode = null;
        let responseBody = null;
        let attemptStatus = "FAILED";
        let attemptError = null;

        try {
            console.log(`[WebhookService] Attempt ${attempt}/${maxAttempts} sending webhook to: ${webhookUrl}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

            const response = await fetch(webhookUrl, {
                method: "POST",
                headers,
                body: payloadString,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const durationMs = Date.now() - startTime;
            responseCode = response.status;

            try {
                responseBody = await response.text();
            } catch (bodyErr) {
                responseBody = "";
            }

            if (response.ok) {
                attemptStatus = "SUCCESS";
                finalSuccess = true;

                await logWebhookAttempt({
                    notificationId: notification.id,
                    customerId,
                    webhookUrl,
                    payload,
                    attemptNumber: attempt,
                    status: attemptStatus,
                    responseCode,
                    responseBody,
                    durationMs
                });

                console.log(`[WebhookService] Webhook delivered successfully on attempt ${attempt} (Status: ${responseCode})`);
                break;
            } else {
                attemptError = `HTTP Error ${response.status}: ${response.statusText}`;
            }
        } catch (fetchErr) {
            attemptError = fetchErr.message;
        }

        const durationMs = Date.now() - startTime;
        lastError = attemptError;

        // Log failed or retrying attempt
        const isLastAttempt = attempt === maxAttempts;
        const loggedStatus = isLastAttempt ? "FAILED" : "RETRYING";

        await logWebhookAttempt({
            notificationId: notification.id,
            customerId,
            webhookUrl,
            payload,
            attemptNumber: attempt,
            status: loggedStatus,
            responseCode,
            responseBody,
            errorMessage: attemptError,
            durationMs
        });

        if (!finalSuccess && !isLastAttempt) {
            // Exponential backoff: 1s, 2s, 4s...
            const backoffMs = Math.pow(2, attempt - 1) * 1000;
            console.log(`[WebhookService] Attempt ${attempt} failed (${attemptError}). Retrying in ${backoffMs}ms...`);
            await sleep(backoffMs);
        }
    }

    return {
        success: finalSuccess,
        error: finalSuccess ? null : lastError
    };
};

module.exports = {
    sendWebhookNotification,
    logWebhookAttempt
};
