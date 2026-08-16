/**
 * Token & session service.
 *
 * Owns access-token signing, refresh-token rotation, and the `sessions` table.
 * Refresh tokens are random 256-bit values; only their SHA-256 hash is stored,
 * so a database leak cannot be replayed against the API.
 */

const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const pool = require("../config/database");

// ------------------------------------------------------
// Config
// ------------------------------------------------------

const ACCESS_TOKEN_TTL =
    process.env.JWT_ACCESS_EXPIRES ||
    process.env.JWT_EXPIRES_IN ||
    "15m";

const REFRESH_TOKEN_TTL_DAYS = Number(
    process.env.JWT_REFRESH_EXPIRES_DAYS || 30
);

const getAccessSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    return secret;
};

// ------------------------------------------------------
// Hashing
// ------------------------------------------------------

const hashToken = (token) =>
    crypto.createHash("sha256").update(String(token)).digest("hex");

const generateOpaqueToken = () =>
    crypto.randomBytes(32).toString("hex");

// ------------------------------------------------------
// Access token
// ------------------------------------------------------

const signAccessToken = (user) =>
    jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            customer_id: user.customer_id
        },
        getAccessSecret(),
        { expiresIn: ACCESS_TOKEN_TTL }
    );

// ------------------------------------------------------
// Session creation
// ------------------------------------------------------

/**
 * Create a session row and return the plaintext refresh token exactly once.
 */
const createSession = async ({
    userId,
    userAgent = null,
    ipAddress = null,
    client = null
}) => {
    const db = client || pool;

    const refreshToken = generateOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);

    const expiresAt = new Date(
        Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    );

    const result = await db.query(
        `
        INSERT INTO sessions (
            user_id,
            refresh_token_hash,
            user_agent,
            device_info,
            ip_address,
            expires_at,
            last_active_at,
            revoked,
            created_at
        )
        VALUES ($1, $2, $3::varchar, $4::text, $5::varchar, $6::timestamp, CURRENT_TIMESTAMP, FALSE, CURRENT_TIMESTAMP)
        RETURNING id, user_id, created_at, expires_at
        `,
        [
            Number(userId),
            refreshTokenHash,
            userAgent ? String(userAgent).slice(0, 500) : null,
            userAgent ? String(userAgent).slice(0, 500) : null,
            ipAddress ? String(ipAddress).slice(0, 64) : null,
            expiresAt
        ]
    );

    return {
        session: result.rows[0],
        refreshToken
    };
};

// ------------------------------------------------------
// Refresh rotation
// ------------------------------------------------------

/**
 * Validate a refresh token and rotate it.
 *
 * Rotation means: the presented token is revoked and a brand-new one is issued
 * in the same transaction. Presenting an already-revoked token is treated as
 * replay and revokes every session for that user.
 */
const rotateRefreshToken = async ({
    refreshToken,
    userAgent = null,
    ipAddress = null
}) => {
    if (!refreshToken) {
        const error = new Error("Refresh token is required");
        error.statusCode = 401;
        throw error;
    }

    const presentedHash = hashToken(refreshToken);
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const sessionResult = await client.query(
            `
            SELECT
                s.id,
                s.user_id,
                s.revoked,
                s.expires_at,
                u.email,
                u.role,
                u.customer_id,
                u.is_active,
                u.name
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.refresh_token_hash = $1
            FOR UPDATE OF s
            `,
            [presentedHash]
        );

        if (sessionResult.rows.length === 0) {
            await client.query("ROLLBACK");
            const error = new Error("Invalid refresh token");
            error.statusCode = 401;
            throw error;
        }

        const session = sessionResult.rows[0];

        // Replay detection: a revoked token being presented again means the
        // token was captured. Defensively kill every session for this user.
        if (session.revoked) {
            await client.query(
                `
                UPDATE sessions
                SET revoked = TRUE,
                    revoked_at = CURRENT_TIMESTAMP
                WHERE user_id = $1
                  AND revoked = FALSE
                `,
                [session.user_id]
            );

            await client.query("COMMIT");

            const error = new Error(
                "Refresh token has already been used. All sessions revoked."
            );
            error.statusCode = 401;
            throw error;
        }

        if (session.expires_at && new Date(session.expires_at) < new Date()) {
            await client.query(
                `
                UPDATE sessions
                SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
                WHERE id = $1
                `,
                [session.id]
            );

            await client.query("COMMIT");

            const error = new Error("Refresh token has expired");
            error.statusCode = 401;
            throw error;
        }

        if (!session.is_active) {
            await client.query("ROLLBACK");
            const error = new Error("User account is inactive");
            error.statusCode = 403;
            throw error;
        }

        // Revoke the presented token.
        await client.query(
            `
            UPDATE sessions
            SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1
            `,
            [session.id]
        );

        // Issue its replacement.
        const { refreshToken: nextRefreshToken } = await createSession({
            userId: session.user_id,
            userAgent,
            ipAddress,
            client
        });

        await client.query("COMMIT");

        const user = {
            id: session.user_id,
            name: session.name,
            email: session.email,
            role: session.role,
            customer_id: session.customer_id
        };

        return {
            accessToken: signAccessToken(user),
            refreshToken: nextRefreshToken,
            user
        };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            // The transaction may already be closed; nothing further to do.
        }

        throw error;
    } finally {
        client.release();
    }
};

// ------------------------------------------------------
// Session listing / revocation
// ------------------------------------------------------

const listSessions = async (userId) => {
    const result = await pool.query(
        `
        SELECT
            id,
            user_agent,
            ip_address,
            created_at,
            last_active_at,
            expires_at,
            revoked,
            revoked_at
        FROM sessions
        WHERE user_id = $1
        ORDER BY revoked ASC, created_at DESC
        `,
        [Number(userId)]
    );

    return result.rows;
};

const revokeSession = async ({ sessionId, userId }) => {
    const result = await pool.query(
        `
        UPDATE sessions
        SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND user_id = $2
          AND revoked = FALSE
        RETURNING id
        `,
        [Number(sessionId), Number(userId)]
    );

    return result.rows[0] || null;
};

const revokeAllSessions = async ({ userId, exceptRefreshToken = null }) => {
    const values = [Number(userId)];
    let exceptClause = "";

    if (exceptRefreshToken) {
        values.push(hashToken(exceptRefreshToken));
        exceptClause = ` AND refresh_token_hash <> $${values.length}`;
    }

    const result = await pool.query(
        `
        UPDATE sessions
        SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
          AND revoked = FALSE
          ${exceptClause}
        RETURNING id
        `,
        values
    );

    return result.rows.length;
};

const revokeByRefreshToken = async (refreshToken) => {
    if (!refreshToken) {
        return null;
    }

    const result = await pool.query(
        `
        UPDATE sessions
        SET revoked = TRUE, revoked_at = CURRENT_TIMESTAMP
        WHERE refresh_token_hash = $1
          AND revoked = FALSE
        RETURNING id, user_id
        `,
        [hashToken(refreshToken)]
    );

    return result.rows[0] || null;
};

const touchSession = async (refreshToken) => {
    if (!refreshToken) {
        return;
    }

    await pool.query(
        `
        UPDATE sessions
        SET last_active_at = CURRENT_TIMESTAMP
        WHERE refresh_token_hash = $1
        `,
        [hashToken(refreshToken)]
    );
};

module.exports = {
    ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL_DAYS,
    hashToken,
    generateOpaqueToken,
    signAccessToken,
    createSession,
    rotateRefreshToken,
    listSessions,
    revokeSession,
    revokeAllSessions,
    revokeByRefreshToken,
    touchSession
};
