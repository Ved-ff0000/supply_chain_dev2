let nodemailer = null;
try {
    nodemailer = require("nodemailer");
} catch (err) {
    console.warn("[EmailService] nodemailer package not loaded, using mock transporter.");
}

// ------------------------------------------------------
// Transport resolution
// ------------------------------------------------------
//
// Three modes, in priority order:
//
//   1. Real SMTP  — SMTP_HOST + SMTP_USER are set.
//   2. Ethereal   — EMAIL_MODE=ethereal (default in development). A throwaway
//                   test inbox is created at boot; every send returns a preview
//                   URL that is logged, so password-reset and verification
//                   links can be followed end to end without a real mailbox.
//   3. JSON       — last resort, messages are serialised to the log.
//
// The transport is resolved lazily and cached, so a slow Ethereal handshake
// never blocks server start-up.

let transporterPromise = null;

const buildSmtpTransport = () =>
    nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

const buildEtherealTransport = async () => {
    const account = await nodemailer.createTestAccount();

    console.log(
        "========================================\n" +
        "[EmailService] Ethereal test inbox ready\n" +
        `  User:    ${account.user}\n` +
        `  Pass:    ${account.pass}\n` +
        "  Inbox:   https://ethereal.email/login\n" +
        "  Preview URLs are printed with each send.\n" +
        "========================================"
    );

    return nodemailer.createTransport({
        host: account.smtp.host,
        port: account.smtp.port,
        secure: account.smtp.secure,
        auth: {
            user: account.user,
            pass: account.pass
        }
    });
};

const resolveTransporter = async () => {
    if (!nodemailer) {
        return null;
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        return buildSmtpTransport();
    }

    const mode = String(
        process.env.EMAIL_MODE ||
            (process.env.NODE_ENV === "production" ? "json" : "ethereal")
    ).toLowerCase();

    if (mode === "ethereal") {
        try {
            return await buildEtherealTransport();
        } catch (error) {
            console.warn(
                `[EmailService] Ethereal unavailable (${error.message}). Falling back to JSON transport.`
            );
        }
    }

    return nodemailer.createTransport({ jsonTransport: true });
};

const getTransporter = () => {
    if (!transporterPromise) {
        transporterPromise = resolveTransporter().catch((error) => {
            console.error(
                "[EmailService] Transport initialisation failed:",
                error.message
            );
            transporterPromise = null;
            return null;
        });
    }

    return transporterPromise;
};

/**
 * Send a message and surface the Ethereal preview URL when one exists.
 */
const deliver = async (message) => {
    const transporter = await getTransporter();

    if (!transporter) {
        console.log(
            `[EmailService - Mock] Would send to ${message.to}: ${message.subject}`
        );
        return { success: true, mock: true };
    }

    const info = await transporter.sendMail(message);

    let previewUrl = null;

    if (nodemailer.getTestMessageUrl) {
        previewUrl = nodemailer.getTestMessageUrl(info) || null;
    }

    if (previewUrl) {
        console.log(`[EmailService] Preview: ${previewUrl}`);
    }

    if (info.message && !previewUrl) {
        // jsonTransport: log the payload so links remain reachable in dev.
        console.log(`[EmailService] ${String(info.message).slice(0, 800)}`);
    }

    return {
        success: true,
        messageId: info.messageId || null,
        previewUrl
    };
};

/**
 * Shared shell so every message in the system looks identical.
 */
const renderEmailShell = ({ heading, bodyHtml, accentColor = "#2563eb" }) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; }
        .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
        .content { padding: 32px 24px; }
        .btn { display: inline-block; background: ${accentColor}; color: #ffffff !important; text-decoration: none; padding: 12px 22px; border-radius: 6px; font-weight: 600; }
        .muted { font-size: 12px; color: #64748b; word-break: break-all; }
        .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin:0; font-size: 20px;">Supply Chain Notification Hub</h2>
        </div>
        <div class="content">
            <h3 style="margin-top:0; color:#0f172a;">${heading}</h3>
            ${bodyHtml}
        </div>
        <div class="footer">
            &copy; ${new Date().getFullYear()} Supply Chain Notification Hub.
        </div>
    </div>
</body>
</html>
`;

const getFromAddress = () =>
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    '"Supply Chain Hub" <notifications@supplychainhub.example>';

const getAppUrl = () =>
    (process.env.APP_URL || "http://localhost:4173").replace(/\/$/, "");

/**
 * Password reset email (Feature 5).
 */
const sendPasswordResetEmail = async ({ to, name, token }) => {
    const link = `${getAppUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const minutes = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60);

    try {
        return await deliver({
            from: getFromAddress(),
            to,
            subject: "Reset your Supply Chain Hub password",
            text:
                `Hello ${name || "there"},\n\n` +
                `A password reset was requested for your account.\n\n` +
                `Reset your password: ${link}\n\n` +
                `This link expires in ${minutes} minutes. ` +
                `If you did not request this, you can safely ignore this email.`,
            html: renderEmailShell({
                heading: "Reset your password",
                bodyHtml: `
                    <p>Hello <strong>${name || "there"}</strong>,</p>
                    <p>A password reset was requested for your account.</p>
                    <p style="margin:24px 0;"><a class="btn" href="${link}">Reset password</a></p>
                    <p class="muted">Or paste this link into your browser:<br>${link}</p>
                    <p style="font-size:14px;color:#475569;">This link expires in ${minutes} minutes. If you did not request this, no action is needed.</p>
                `
            })
        });
    } catch (error) {
        console.error(`[EmailService] Password reset email failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Email verification message (Feature 5).
 */
const sendVerificationEmail = async ({ to, name, token }) => {
    const link = `${getAppUrl()}/verify-email?token=${encodeURIComponent(token)}`;

    try {
        return await deliver({
            from: getFromAddress(),
            to,
            subject: "Verify your Supply Chain Hub email",
            text:
                `Welcome ${name || "there"},\n\n` +
                `Confirm your email address: ${link}\n\n` +
                `This link expires in 24 hours.`,
            html: renderEmailShell({
                heading: "Confirm your email address",
                accentColor: "#10b981",
                bodyHtml: `
                    <p>Welcome <strong>${name || "there"}</strong>,</p>
                    <p>Confirm your email address to activate every feature of your account.</p>
                    <p style="margin:24px 0;"><a class="btn" href="${link}">Verify email</a></p>
                    <p class="muted">Or paste this link into your browser:<br>${link}</p>
                    <p style="font-size:14px;color:#475569;">This link expires in 24 hours.</p>
                `
            })
        });
    } catch (error) {
        console.error(`[EmailService] Verification email failed: ${error.message}`);
        return { success: false, error: error.message };
    }
};

/**
 * Send an HTML and plain-text shipment update email.
 */
const sendShipmentNotificationEmail = async ({
    to,
    customerName,
    trackingNumber,
    status,
    title,
    message,
    priority = "NORMAL"
}) => {
    if (!to) {
        console.warn("[EmailService] No recipient email specified.");
        return { success: false, reason: "No recipient email" };
    }

    const fromAddress = process.env.FROM_EMAIL || '"Supply Chain Hub" <notifications@supplychainhub.example>';
    const subject = `[${priority}] ${title} - Tracking #${trackingNumber}`;

    const priorityColors = {
        URGENT: "#dc2626",
        HIGH: "#ea580c",
        NORMAL: "#2563eb",
        LOW: "#64748b"
    };

    const statusBadgeColor = priorityColors[String(priority).toUpperCase()] || "#2563eb";

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
            .header { background: #0f172a; color: #ffffff; padding: 24px; text-align: center; }
            .content { padding: 32px 24px; }
            .badge { display: inline-block; padding: 4px 12px; font-size: 12px; font-weight: 600; border-radius: 9999px; color: #ffffff; background-color: ${statusBadgeColor}; }
            .card { background: #f1f5f9; border-radius: 6px; padding: 16px; margin: 20px 0; border-left: 4px solid ${statusBadgeColor}; }
            .footer { background: #f8fafc; padding: 16px 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2 style="margin:0; font-size: 20px;">Supply Chain Notification Hub</h2>
            </div>
            <div class="content">
                <p>Hello <strong>${customerName || "Customer"}</strong>,</p>
                <div style="margin-bottom: 12px;">
                    <span class="badge">${priority} PRIORITY</span>
                </div>
                <h3 style="margin-top: 8px; color: #0f172a;">${title}</h3>
                <div class="card">
                    <p style="margin: 0 0 8px 0;"><strong>Tracking Number:</strong> ${trackingNumber}</p>
                    <p style="margin: 0 0 8px 0;"><strong>New Status:</strong> ${status}</p>
                    <p style="margin: 0;"><strong>Details:</strong> ${message}</p>
                </div>
                <p style="font-size: 14px; color: #475569;">You received this email according to your notification preferences.</p>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} Supply Chain Notification Hub. All rights reserved.
            </div>
        </div>
    </body>
    </html>
    `;

    const textContent = `
Supply Chain Notification Hub
----------------------------------------
Hello ${customerName || "Customer"},

${title}
Status: ${status}
Tracking Number: ${trackingNumber}
Priority: ${priority}

Details:
${message}

----------------------------------------
Notification generated at: ${new Date().toISOString()}
    `.trim();

    try {
        const result = await deliver({
            from: fromAddress,
            to,
            subject,
            text: textContent,
            html: htmlContent
        });

        console.log(
            `[EmailService] Shipment email sent to ${to} (${trackingNumber}).`
        );

        return result;
    } catch (error) {
        console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendShipmentNotificationEmail,
    sendPasswordResetEmail,
    sendVerificationEmail
};
