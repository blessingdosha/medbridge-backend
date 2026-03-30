const pool = require("../db");

const addEquipment = async (req, res) => {
  const { name, type, hospital_id, availability, description } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO equipment (name, type, hospital_id, availability, description) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, type, hospital_id, availability, description]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAvailableEquipment = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT e.*, h.name AS hospital_name FROM equipment e JOIN hospitals h ON e.hospital_id = h.id WHERE e.availability = TRUE"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addEquipment, getAvailableEquipment };