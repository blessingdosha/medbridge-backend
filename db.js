const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: 5432,
});

// Test connection and log result
pool
  .connect()
  .then((client) => {
    console.log("Database connected successfully.");
    client.release();
  })
  .catch((err) => {
    console.error("Database connection error:", err.stack);
  });

pool.on("error", (err) => {
  console.error("Unexpected error on idle client", err);
  process.exit(-1);
});

module.exports = pool;
