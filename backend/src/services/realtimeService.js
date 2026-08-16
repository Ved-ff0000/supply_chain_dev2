/**
 * Real-time notification fan-out over Server-Sent Events.
 *
 * SSE is used rather than WebSockets because the payload is strictly
 * server -> client, it rides on plain HTTP (so the existing dev-server proxy
 * and any reverse proxy work untouched), and browsers reconnect automatically.
 *
 * Clients are indexed by user id. Staff (ADMIN/OPERATIONS) additionally join a
 * broadcast group so fleet-wide events reach them without a customer link.
 */

const clients = new Map(); // userId -> Set<res>

const STAFF_ROLES = new Set(["ADMIN", "OPERATIONS"]);

const HEARTBEAT_MS = Number(process.env.SSE_HEARTBEAT_MS || 25000);

/**
 * Write one SSE frame.
 */
const writeEvent = (res, event, data) => {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        return true;
    } catch (error) {
        return false;
    }
};

/**
 * Register a subscriber. Returns a cleanup function.
 */
const addClient = (req, res, user) => {
    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        // Defeat proxy buffering so events arrive immediately.
        "X-Accel-Buffering": "no"
    });

    if (typeof res.flushHeaders === "function") {
        res.flushHeaders();
    }

    const entry = {
        res,
        userId: user.id,
        role: String(user.role || "").toUpperCase(),
        customerId: user.customer_id || null
    };

    if (!clients.has(user.id)) {
        clients.set(user.id, new Set());
    }

    clients.get(user.id).add(entry);

    writeEvent(res, "connected", {
        message: "Realtime notification stream connected",
        user_id: user.id,
        role: entry.role,
        timestamp: new Date().toISOString()
    });

    // Comment-only heartbeat keeps intermediaries from closing an idle stream.
    const heartbeat = setInterval(() => {
        try {
            res.write(": ping\n\n");
        } catch (error) {
            clearInterval(heartbeat);
        }
    }, HEARTBEAT_MS);

    const cleanup = () => {
        clearInterval(heartbeat);

        const set = clients.get(user.id);

        if (set) {
            set.delete(entry);

            if (set.size === 0) {
                clients.delete(user.id);
            }
        }
    };

    req.on("close", cleanup);
    req.on("error", cleanup);

    return cleanup;
};

/**
 * Push a notification to everyone entitled to see it:
 *   - users linked to the owning customer
 *   - all staff (fleet-wide visibility)
 */
const publishNotification = (notification) => {
    if (!notification) {
        return 0;
    }

    const customerId = notification.customer_id;
    let delivered = 0;

    for (const entries of clients.values()) {
        for (const entry of entries) {
            const isOwner =
                customerId != null &&
                entry.customerId != null &&
                Number(entry.customerId) === Number(customerId);

            const isStaff = STAFF_ROLES.has(entry.role);

            if (!isOwner && !isStaff) {
                continue;
            }

            if (writeEvent(entry.res, "notification", notification)) {
                delivered += 1;
            }
        }
    }

    return delivered;
};

/**
 * Push an arbitrary named event (e.g. shipment.updated) to entitled clients.
 */
const publishEvent = (eventName, payload, { customerId = null } = {}) => {
    let delivered = 0;

    for (const entries of clients.values()) {
        for (const entry of entries) {
            const isOwner =
                customerId != null &&
                entry.customerId != null &&
                Number(entry.customerId) === Number(customerId);

            const isStaff = STAFF_ROLES.has(entry.role);

            if (customerId != null && !isOwner && !isStaff) {
                continue;
            }

            if (writeEvent(entry.res, eventName, payload)) {
                delivered += 1;
            }
        }
    }

    return delivered;
};

const getConnectionCount = () => {
    let total = 0;

    for (const entries of clients.values()) {
        total += entries.size;
    }

    return total;
};

module.exports = {
    addClient,
    publishNotification,
    publishEvent,
    getConnectionCount
};
