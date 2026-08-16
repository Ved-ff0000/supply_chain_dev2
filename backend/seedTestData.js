const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/config/database');

async function seed() {
  try {
    console.log('Seeding test data...');

    // Add test shipments
    await pool.query(`
      INSERT INTO shipments (tracking_number, customer_id, carrier_id, origin, destination, status, priority, expected_delivery, created_at)
      VALUES 
        ('TEST-DHL-001', 1, 1, 'Shanghai Port, CN', 'Los Angeles Gateway, US', 'IN_TRANSIT', 'HIGH', CURRENT_TIMESTAMP + INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '2 days'),
        ('TEST-FDX-002', 1, 2, 'Singapore Terminal, SG', 'New York Hub, US', 'DELIVERED', 'NORMAL', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '8 days'),
        ('TEST-UPS-003', 1, 3, 'Dubai Cargo, AE', 'London Heathrow, UK', 'CUSTOMS_HOLD', 'URGENT', CURRENT_TIMESTAMP + INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '5 days'),
        ('TEST-DHL-004', 1, 1, 'Tokyo Port, JP', 'Seattle Gateway, US', 'OUT_FOR_DELIVERY', 'HIGH', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP - INTERVAL '6 days'),
        ('TEST-FDX-005', 1, 2, 'Hong Kong Terminal, HK', 'Frankfurt Hub, DE', 'DELAYED', 'NORMAL', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '10 days')
      ON CONFLICT DO NOTHING
    `);

    console.log('✓ Seeded test shipments');

    // Add test notifications
    await pool.query(`
      INSERT INTO notifications (shipment_id, customer_id, type, title, message, channel, status, priority, created_at)
      SELECT id, customer_id, status, 'Shipment ' || status, 'Your shipment ' || tracking_number || ' is now ' || status, 'IN_APP', 'UNREAD', 'HIGH', CURRENT_TIMESTAMP - INTERVAL '1 hour'
      FROM shipments
      WHERE tracking_number LIKE 'TEST-%'
      ON CONFLICT DO NOTHING
    `);

    console.log('✓ Seeded test notifications');

    console.log('\nSeeding complete!');
    await pool.end();
  } catch (e) {
    console.error('Seed error:', e.message);
    process.exit(1);
  }
}

seed();
