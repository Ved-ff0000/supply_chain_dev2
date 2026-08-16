const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const fs = require('fs');
const pool = require('./src/config/database');

async function applySchema() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Applying schema...');
    await pool.query(schema);
    console.log('✓ Schema applied successfully');
    
    await pool.end();
  } catch (error) {
    console.error('Error applying schema:', error.message);
    process.exit(1);
  }
}

applySchema();
