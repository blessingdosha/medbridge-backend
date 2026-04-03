const pool = require("../db");

const addEquipment = async (req, res) => {
  const { name, type, facility_id, availability } = req.body;
  try {
    const insertResult = await pool.query(
      "INSERT INTO equipment (name, type, facility_id, availability) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, type, facility_id, availability],
    );
    const equipment = insertResult.rows[0];
    // Fetch with facility name
    const result = await pool.query(
      `SELECT e.*, h.name AS facility_name FROM equipment e JOIN facilities h ON e.facility_id = h.id WHERE e.id = $1`,
      [equipment.id],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAvailableEquipment = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT e.*, h.name AS facility_name FROM equipment e JOIN facilities h ON e.facility_id = h.id",
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addEquipment, getAvailableEquipment };
