const pool = require("../db");

// Add a laboratory
const addLaboratory = async (req, res) => {
  const { name, location, contact_email, contact_phone, latitude, longitude, services } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO laboratories (name, location, contact_email, contact_phone, facility_type, latitude, longitude, services) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [name, location, contact_email, contact_phone, "laboratory", latitude, longitude, services]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all laboratories
const getAllLaboratories = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM laboratories");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addLaboratory, getAllLaboratories };