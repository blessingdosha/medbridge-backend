/**
 * Apply tenancy_migration.sql to an existing database (no full reset).
 * Usage: npm run migrate
 */
const fs = require("fs");
const path = require("path");
const pool = require("./db");

async function migrate() {
  const tenancyPath = path.join(__dirname, "sql", "tenancy_migration.sql");
  const patientPath = path.join(__dirname, "sql", "patient_records_migration.sql");
  const visitPath = path.join(
    __dirname,
    "sql",
    "equipment_request_patient_visit_migration.sql",
  );
  const hospitalLocationPath = path.join(
    __dirname,
    "sql",
    "hospital_location_migration.sql",
  );
  const equipmentBookingEndPath = path.join(
    __dirname,
    "sql",
    "equipment_booking_end_migration.sql",
  );
  await pool.query(fs.readFileSync(tenancyPath, "utf8"));
  console.log("Tenancy migration applied successfully.");
  await pool.query(fs.readFileSync(patientPath, "utf8"));
  console.log("Patient records migration applied successfully.");
  await pool.query(fs.readFileSync(visitPath, "utf8"));
  console.log("Equipment request patient visit migration applied successfully.");
  await pool.query(fs.readFileSync(hospitalLocationPath, "utf8"));
  console.log("Hospital location migration applied successfully.");
  await pool.query(fs.readFileSync(equipmentBookingEndPath, "utf8"));
  console.log("Equipment booking end migration applied successfully.");
}

migrate()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
