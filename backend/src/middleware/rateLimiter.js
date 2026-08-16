/**
 * Database-backed rate limiter for authentication routes.
 *
 * Counting lives in Postgres (`auth_rate_limit`) rather than process memory so
 * limits survive restarts and hold across multiple instances. Each
 * identifier+endpoint pair gets a fixed window; the row is reset once the
 * window elapses.
 */

const pool = require("../config/database");

const DEFAULT_WINDOW_MS = Number(
    process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000
);

const DEFAULT_MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_MAX || 10);

/**
 * Resolve the client identifier. Prefers the submitted email so that an
 * attacker rotating IPs still trips the limit on a targeted account, and
 * falls back to the request IP.
 */
const resolveIdentifier = (req) => {
    const email = req.body && req.body.email;

    if (email && typeof email === "string") {
        return `email:${email.trim().toLowerCase()}`;
    }

    const forwarded = req.headers["x-forwarded-for"];
    const ip =
        (typeof forwarded === "string" && forwarded.split(",")[0].trim()) ||
        req.ip ||
        (req.socket && req.socket.remoteAddress) ||
        "unknown";

    return `ip:${ip}`;
};

/**
 * Build a rate limiting middleware.
 */
const rateLimit = ({
    endpoint,
    max = DEFAULT_MAX_ATTEMPTS,
    windowMs = DEFAULT_WINDOW_MS
} = {}) => {
    return async (req, res, next) => {
        const identifier = resolveIdentifier(req);
        const windowSeconds = Math.ceil(windowMs / 1000);

        try {
            // Upsert then evaluate. If the stored window has expired the row is
            // reset to a single attempt, otherwise the counter increments.
            const result = await pool.query(
                `
                INSERT INTO auth_rate_limit (identifier, endpoint, attempts, window_start)
                VALUES ($1, $2, 1, CURRENT_TIMESTAMP)
                ON CONFLICT (identifier, endpoint) DO UPDATE
                SET
                    attempts = CASE
                        WHEN auth_rate_limit.window_start
                             < CURRENT_TIMESTAMP - ($3::int * INTERVAL '1 second')
                        THEN 1
                        ELSE auth_rate_limit.attempts + 1
                    END,
                    window_start = CASE
                        WHEN auth_rate_limit.window_start
                             < CURRENT_TIMESTAMP - ($3::int * INTERVAL '1 second')
                        THEN CURRENT_TIMESTAMP
                        ELSE auth_rate_limit.window_start
                    END
                RETURNING
                    attempts,
                    window_start,
                    EXTRACT(EPOCH FROM (
                        window_start + ($3::int * INTERVAL '1 second')
                        - CURRENT_TIMESTAMP
                    ))::int AS retry_after_seconds
                `,
                [identifier, endpoint, windowSeconds]
            );

            const row = result.rows[0];
            const attempts = Number(row.attempts);
            const remaining = Math.max(max - attempts, 0);

            res.setHeader("X-RateLimit-Limit", String(max));
            res.setHeader("X-RateLimit-Remaining", String(remaining));

            if (attempts > max) {
                const retryAfter = Math.max(
                    Number(row.retry_after_seconds) || windowSeconds,
                    1
                );

                res.setHeader("Retry-After", String(retryAfter));

                return res.status(429).json({
                    success: false,
                    message:
                        "Too many attempts. Please try again later.",
                    retry_after_seconds: retryAfter
                });
            }

            return next();
        } catch (error) {
            // A limiter outage must not take authentication offline.
            console.error(
                "[RateLimiter] Check failed, allowing request:",
                error.message
            );

            return next();
        }
    };
};

/**
 * Clear the counter for a successful authentication so that a legitimate user
 * is not penalised for earlier typos.
 */
const clearRateLimit = async (req, endpoint) => {
    try {
        await pool.query(
            `
            DELETE FROM auth_rate_limit
            WHERE identifier = $1 AND endpoint = $2
            `,
            [resolveIdentifier(req), endpoint]
        );
    } catch (error) {
        console.error("[RateLimiter] Failed to clear counter:", error.message);
    }
};

module.exports = {
    rateLimit,
    clearRateLimit,
    resolveIdentifier
};
