const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function initDB() {
  try {
    const schemaPath = path.join(__dirname, 'database_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Running database schema creation...');
    await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    await pool.query(schemaSql);
    console.log('Database schema created successfully!');
  } catch (err) {
    console.error('Error creating database schema:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

initDB();
