/**
 * Demo data seeder.
 *
 * Creates a realistic, self-consistent dataset so every dashboard, chart and
 * list has something meaningful to show on a fresh install:
 *
 *   - one user per role (ADMIN / OPERATIONS / CUSTOMER)
 *   - three customers and four carriers
 *   - ~70 shipments spread over the last 90 days, with a believable mix of
 *     delivered / in-flight / delayed / customs-hold states
 *   - shipment_events forming a coherent timeline per shipment
 *   - notifications and notification preferences
 *
 * Safe to re-run: it clears only the rows it owns, then recreates them.
 *
 *   node seedDemoData.js
 */

const path = require("path");
const bcrypt = require("bcryptjs");

require("dotenv").config({ path: path.join(__dirname, ".env") });

const pool = require("./src/config/database");

// ------------------------------------------------------
// Reference data
// ------------------------------------------------------

const CARRIERS = [
    { name: "DHL Express", code: "DHL", api_enabled: true },
    { name: "FedEx", code: "FEDEX", api_enabled: true },
    { name: "UPS", code: "UPS", api_enabled: false },
    { name: "Maersk Line", code: "MAERSK", api_enabled: false }
];

const CUSTOMERS = [
    {
        name: "Acme Logistics Buyer",
        email: "buyer@acme.example",
        phone: "+1-555-0100",
        company_name: "Acme Corp"
    },
    {
        name: "Global Tech Imports",
        email: "ops@globaltech.example",
        phone: "+1-555-0142",
        company_name: "Global Tech Ltd"
    },
    {
        name: "Nordic Retail Group",
        email: "supply@nordicretail.example",
        phone: "+46-8-555-0177",
        company_name: "Nordic Retail AB"
    }
];

const ROUTES = [
    ["Shenzhen, CN", "Frankfurt, DE"],
    ["Shanghai, CN", "Los Angeles, US"],
    ["Singapore, SG", "Rotterdam, NL"],
    ["Hyderabad, IN", "London, UK"],
    ["Tokyo, JP", "Seattle, US"],
    ["Dubai, AE", "Hamburg, DE"],
    ["Busan, KR", "Long Beach, US"],
    ["Ho Chi Minh City, VN", "Antwerp, BE"]
];

const PRIORITIES = ["LOW", "NORMAL", "NORMAL", "HIGH", "HIGH", "URGENT"];

// Deterministic pseudo-random so re-seeding produces a comparable dataset.
let seed = 20260816;

const random = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
};

const pick = (list) => list[Math.floor(random() * list.length)];
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;

const hoursAgo = (hours) => new Date(Date.now() - hours * 3600 * 1000);

// ------------------------------------------------------
// Lifecycle templates
// ------------------------------------------------------
//
// Each template is an ordered list of statuses that respects the transition
// rules in src/constants/statusTransitions.js.

const LIFECYCLES = {
    DELIVERED: [
        "CREATED",
        "PICKED_UP",
        "IN_TRANSIT",
        "ARRIVED_AT_DESTINATION",
        "OUT_FOR_DELIVERY",
        "DELIVERED"
    ],
    DELIVERED_VIA_CUSTOMS: [
        "CREATED",
        "PICKED_UP",
        "IN_TRANSIT",
        "ARRIVED_AT_DESTINATION",
        "CUSTOMS_HOLD",
        "CUSTOMS_CLEARED",
        "OUT_FOR_DELIVERY",
        "DELIVERED"
    ],
    IN_TRANSIT: ["CREATED", "PICKED_UP", "IN_TRANSIT"],
    CUSTOMS_HOLD: [
        "CREATED",
        "PICKED_UP",
        "IN_TRANSIT",
        "ARRIVED_AT_DESTINATION",
        "CUSTOMS_HOLD"
    ],
    DELAYED: ["CREATED", "PICKED_UP", "IN_TRANSIT", "DELAYED"],
    OUT_FOR_DELIVERY: [
        "CREATED",
        "PICKED_UP",
        "IN_TRANSIT",
        "ARRIVED_AT_DESTINATION",
        "OUT_FOR_DELIVERY"
    ]
};

// Weighted so the fleet looks healthy but not perfect.
const LIFECYCLE_MIX = [
    ...Array(26).fill("DELIVERED"),
    ...Array(8).fill("DELIVERED_VIA_CUSTOMS"),
    ...Array(14).fill("IN_TRANSIT"),
    ...Array(5).fill("CUSTOMS_HOLD"),
    ...Array(8).fill("DELAYED"),
    ...Array(6).fill("OUT_FOR_DELIVERY")
];

// ------------------------------------------------------
// Seeder
// ------------------------------------------------------

const seedDemoData = async () => {
    const client = await pool.connect();

    try {
        console.log("Seeding demo data…");

        await client.query("BEGIN");

        // --------------------------------------------------
        // Reset owned rows
        // --------------------------------------------------

        await client.query("DELETE FROM webhook_delivery_log");
        await client.query("DELETE FROM notifications");
        await client.query("DELETE FROM shipment_events");
        await client.query("DELETE FROM audit_log WHERE entity_type = 'SHIPMENT'");
        await client.query("DELETE FROM shipments");

        // --------------------------------------------------
        // Carriers
        // --------------------------------------------------

        const carrierIds = [];

        for (const carrier of CARRIERS) {
            const result = await client.query(
                `
                INSERT INTO carriers (name, code, api_enabled)
                VALUES ($1, $2, $3)
                ON CONFLICT (code) DO UPDATE
                    SET name = EXCLUDED.name,
                        api_enabled = EXCLUDED.api_enabled
                RETURNING id
                `,
                [carrier.name, carrier.code, carrier.api_enabled]
            );

            carrierIds.push(result.rows[0].id);
        }

        console.log(`  carriers:  ${carrierIds.length}`);

        // --------------------------------------------------
        // Customers + preferences
        // --------------------------------------------------

        const customerIds = [];

        for (const customer of CUSTOMERS) {
            const result = await client.query(
                `
                INSERT INTO customers (name, email, phone, company_name)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (email) DO UPDATE
                    SET name = EXCLUDED.name,
                        phone = EXCLUDED.phone,
                        company_name = EXCLUDED.company_name
                RETURNING id
                `,
                [customer.name, customer.email, customer.phone, customer.company_name]
            );

            const customerId = result.rows[0].id;
            customerIds.push(customerId);

            await client.query(
                `
                INSERT INTO notification_preferences (customer_id)
                VALUES ($1)
                ON CONFLICT (customer_id) DO NOTHING
                `,
                [customerId]
            );
        }

        console.log(`  customers: ${customerIds.length}`);

        // --------------------------------------------------
        // Users (one per role)
        // --------------------------------------------------

        const users = [
            {
                name: "System Admin",
                email: "admin@supplychain.local",
                password: "Admin123!",
                role: "ADMIN",
                customer_id: null
            },
            {
                name: "Elena Rostova",
                email: "ops@supplychain.local",
                password: "Operations123!",
                role: "OPERATIONS",
                customer_id: null
            },
            {
                name: "Acme Buyer",
                email: "buyer@acme.example",
                password: "Customer123!",
                role: "CUSTOMER",
                customer_id: customerIds[0]
            }
        ];

        for (const user of users) {
            const passwordHash = await bcrypt.hash(user.password, 12);

            await client.query(
                `
                INSERT INTO users (
                    name, email, password_hash, role, customer_id,
                    is_active, email_verified
                )
                VALUES ($1, $2, $3, $4, $5, TRUE, TRUE)
                ON CONFLICT (email) DO UPDATE
                    SET password_hash = EXCLUDED.password_hash,
                        name = EXCLUDED.name,
                        role = EXCLUDED.role,
                        customer_id = EXCLUDED.customer_id,
                        is_active = TRUE,
                        email_verified = TRUE
                `,
                [
                    user.name,
                    user.email,
                    passwordHash,
                    user.role,
                    user.customer_id
                ]
            );
        }

        console.log(`  users:     ${users.length}`);

        // --------------------------------------------------
        // Shipments + events + notifications
        // --------------------------------------------------

        let shipmentCount = 0;
        let eventCount = 0;
        let notificationCount = 0;

        for (let index = 0; index < LIFECYCLE_MIX.length; index += 1) {
            const lifecycleKey = LIFECYCLE_MIX[index];
            const statuses = LIFECYCLES[lifecycleKey];
            const finalStatus = statuses[statuses.length - 1];

            const carrierId = pick(carrierIds);
            const customerId = pick(customerIds);
            const [origin, destination] = pick(ROUTES);
            const priority = pick(PRIORITIES);

            // Spread creation across the last 90 days.
            const createdHoursAgo = randomInt(6, 90 * 24);
            const createdAt = hoursAgo(createdHoursAgo);

            // Transit budget of 3–16 days.
            const plannedTransitHours = randomInt(72, 384);
            const expectedDelivery = new Date(
                createdAt.getTime() + plannedTransitHours * 3600 * 1000
            );

            let actualDelivery = null;

            if (finalStatus === "DELIVERED") {
                // ~82% land on time; the rest slip, which drives the
                // on-time-rate KPI and the carrier ranking.
                const onTime = random() < 0.82;

                const deliveryOffsetHours = onTime
                    ? -randomInt(2, 36)
                    : randomInt(4, 72);

                actualDelivery = new Date(
                    expectedDelivery.getTime() + deliveryOffsetHours * 3600 * 1000
                );

                // Never in the future.
                if (actualDelivery > new Date()) {
                    actualDelivery = hoursAgo(randomInt(1, 48));
                }
            }

            const trackingPrefix = CARRIERS.find(
                (_, position) => carrierIds[position] === carrierId
            );

            const trackingNumber = `${
                (trackingPrefix && trackingPrefix.code) || "SC"
            }-${String(100000 + index * 37 + randomInt(1, 99))}`;

            const shipmentResult = await client.query(
                `
                INSERT INTO shipments (
                    tracking_number, carrier_id, customer_id,
                    origin, destination, status, priority,
                    expected_delivery, actual_delivery,
                    created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
                RETURNING id
                `,
                [
                    trackingNumber,
                    carrierId,
                    customerId,
                    origin,
                    destination,
                    finalStatus,
                    priority,
                    expectedDelivery,
                    actualDelivery,
                    createdAt
                ]
            );

            const shipmentId = shipmentResult.rows[0].id;
            shipmentCount += 1;

            // Distribute events evenly between creation and completion.
            const endTime = actualDelivery || new Date();
            const span = Math.max(endTime.getTime() - createdAt.getTime(), 3600 * 1000);
            const step = span / statuses.length;

            for (let position = 0; position < statuses.length; position += 1) {
                const status = statuses[position];
                const eventTime = new Date(createdAt.getTime() + step * position);

                await client.query(
                    `
                    INSERT INTO shipment_events (
                        shipment_id, status, location, description, event_time, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $5)
                    `,
                    [
                        shipmentId,
                        status,
                        position === 0
                            ? origin
                            : position === statuses.length - 1
                                ? destination
                                : `In network — ${origin.split(",")[0]} hub`,
                        status === "DELAYED"
                            ? "Automated Delay Detection: shipment exceeded expected delivery date"
                            : `Shipment status changed to ${status}`,
                        eventTime
                    ]
                );

                eventCount += 1;
            }

            // Notifications for the states customers care about.
            const notifiableStatuses = statuses.filter((status) =>
                [
                    "IN_TRANSIT",
                    "CUSTOMS_HOLD",
                    "DELAYED",
                    "OUT_FOR_DELIVERY",
                    "DELIVERED"
                ].includes(status)
            );

            for (const status of notifiableStatuses) {
                const isRecent = createdHoursAgo < 72;

                await client.query(
                    `
                    INSERT INTO notifications (
                        shipment_id, customer_id, type, title, message,
                        channel, status, priority, created_at, read_at
                    )
                    VALUES ($1, $2, $3, $4, $5, 'IN_APP', $6, $7, $8, $9)
                    `,
                    [
                        shipmentId,
                        customerId,
                        status,
                        `Shipment Status: ${status}`,
                        `Your shipment ${trackingNumber} status has changed to ${status}.`,
                        isRecent && random() < 0.6 ? "UNREAD" : "READ",
                        ["DELAYED", "CUSTOMS_HOLD"].includes(status) ? "HIGH" : "NORMAL",
                        hoursAgo(Math.max(createdHoursAgo - randomInt(0, 12), 1)),
                        isRecent && random() < 0.6 ? null : hoursAgo(randomInt(1, 40))
                    ]
                );

                notificationCount += 1;
            }
        }

        // A couple of pending customer requests so the approvals queue is live.
        for (let index = 0; index < 2; index += 1) {
            const [origin, destination] = pick(ROUTES);

            const requesterResult = await client.query(
                "SELECT id FROM users WHERE email = 'buyer@acme.example'"
            );

            const shipmentResult = await client.query(
                `
                INSERT INTO shipments (
                    tracking_number, carrier_id, customer_id,
                    origin, destination, status, priority,
                    expected_delivery, requested_by, created_at, updated_at
                )
                VALUES ($1, $2, $3, $4, $5, 'PENDING_APPROVAL', $6, $7, $8,
                        CURRENT_TIMESTAMP - ($9 * INTERVAL '1 hour'),
                        CURRENT_TIMESTAMP - ($9 * INTERVAL '1 hour'))
                RETURNING id
                `,
                [
                    `REQ-DEMO-${1000 + index}`,
                    pick(carrierIds),
                    customerIds[0],
                    origin,
                    destination,
                    pick(["HIGH", "URGENT"]),
                    new Date(Date.now() + randomInt(5, 14) * 24 * 3600 * 1000),
                    requesterResult.rows[0].id,
                    randomInt(2, 30)
                ]
            );

            await client.query(
                `
                INSERT INTO shipment_events (
                    shipment_id, status, location, description, event_time
                )
                VALUES ($1, 'PENDING_APPROVAL', $2,
                        'Shipment requested by customer, awaiting approval',
                        CURRENT_TIMESTAMP)
                `,
                [shipmentResult.rows[0].id, origin]
            );

            shipmentCount += 1;
            eventCount += 1;
        }

        await client.query("COMMIT");

        console.log(`  shipments: ${shipmentCount}`);
        console.log(`  events:    ${eventCount}`);
        console.log(`  notifications: ${notificationCount}`);
        console.log("\nDemo logins:");
        console.log("  ADMIN       admin@supplychain.local / Admin123!");
        console.log("  OPERATIONS  ops@supplychain.local   / Operations123!");
        console.log("  CUSTOMER    buyer@acme.example      / Customer123!");
        console.log("\nSeeding complete.");
    } catch (error) {
        await client.query("ROLLBACK");
        console.error("Seeding failed:", error.message);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
};

seedDemoData().catch(() => process.exit(1));
