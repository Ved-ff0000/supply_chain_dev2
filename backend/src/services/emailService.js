let nodemailer = null;
try {
    nodemailer = require("nodemailer");
} catch (err) {
    console.warn("[EmailService] nodemailer package not loaded, using mock transporter.");
}

/**
 * Configure email transporter using SMTP environment variables.
 * Falls back to mock json transport in development if credentials are not provided.
 */
const createTransporter = () => {
    if (!nodemailer) {
        return null;
    }

    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === "true",
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    // Default development JSON / Mock transporter
    return nodemailer.createTransport({
        jsonTransport: true
    });
};

const transporter = createTransporter();

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
        if (!transporter) {
            console.log(`[EmailService - Mock] Would send email to: ${to} (Subject: ${subject})`);
            return { success: true, mock: true };
        }

        const info = await transporter.sendMail({
            from: fromAddress,
            to,
            subject,
            text: textContent,
            html: htmlContent
        });

        console.log(`[EmailService] Email sent successfully to ${to}. MessageId: ${info.messageId || "mock"}`);
        return {
            success: true,
            messageId: info.messageId || null
        };
    } catch (error) {
        console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports = {
    sendShipmentNotificationEmail
};
