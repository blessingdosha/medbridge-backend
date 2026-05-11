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
    const migrationPath = path.join(__dirname, 'sql', 'tenancy_migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSql);
    console.log('Tenancy migration applied.');
    const patientPath = path.join(__dirname, 'sql', 'patient_records_migration.sql');
    const patientSql = fs.readFileSync(patientPath, 'utf8');
    await pool.query(patientSql);
    console.log('Patient records migration applied.');
    console.log('Database schema created successfully!');
  } catch (err) {
    console.error('Error creating database schema:', err);
    process.exit(1);
  } finally {
    pool.end();
  }
}

initDB();
