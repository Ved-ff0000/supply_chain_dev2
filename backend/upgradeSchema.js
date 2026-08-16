const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const pool = require('./src/config/database');

async function upgradeSchema() {
  try {
    console.log('Checking schema...');

    // Check if is_deleted column exists in shipments table
    const shipmentColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='shipments' AND column_name='is_deleted'
    `);

    if (shipmentColCheck.rows.length === 0) {
      console.log('Adding is_deleted column to shipments...');
      await pool.query(`
        ALTER TABLE shipments ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN deleted_at TIMESTAMP NULL,
        ADD COLUMN deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✓ Added to shipments');
    }

    // Check if is_deleted column exists in shipment_events table
    const eventsColCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name='shipment_events' AND column_name='is_deleted'
    `);

    if (eventsColCheck.rows.length === 0) {
      console.log('Adding is_deleted column to shipment_events...');
      await pool.query(`
        ALTER TABLE shipment_events ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN deleted_at TIMESTAMP NULL,
        ADD COLUMN deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL
      `);
      console.log('✓ Added to shipment_events');
    }

    // Create indexes
    console.log('Creating indexes...');
    const indexStatements = [
      'CREATE INDEX IF NOT EXISTS idx_shipments_not_deleted ON shipments (is_deleted) WHERE is_deleted = FALSE',
      'CREATE INDEX IF NOT EXISTS idx_shipment_events_not_deleted ON shipment_events (is_deleted) WHERE is_deleted = FALSE',
      'CREATE INDEX IF NOT EXISTS idx_shipments_actual_delivery ON shipments (actual_delivery) WHERE actual_delivery IS NOT NULL AND is_deleted = FALSE'
    ];

    for (const stmt of indexStatements) {
      await pool.query(stmt);
    }
    console.log('✓ Indexes created');

    console.log('✓ Schema upgrade complete');
    await pool.end();
  } catch (error) {
    console.error('Error upgrading schema:', error.message);
    process.exit(1);
  }
}

upgradeSchema();
