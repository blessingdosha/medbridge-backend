const pool = require("../db");

// Create a new equipment request
const requestEquipment = async (req, res) => {
  const { requesting_hospital_id, equipment_id, notes } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO equipment_requests (requesting_hospital_id, equipment_id, notes) VALUES ($1, $2, $3) RETURNING *",
      [requesting_hospital_id, equipment_id, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all requests (for admin approval)
const getAllRequests = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT er.*, h1.name AS requesting_hospital, h2.name AS equipment_hospital FROM equipment_requests er JOIN hospitals h1 ON er.requesting_hospital_id = h1.id JOIN hospitals h2 ON er.equipment_id = h2.id"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Approve or deny a request
const updateRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;
  
  try {
    const result = await pool.query(
      "UPDATE equipment_requests SET status = $1, approved_at = NOW(), rejection_reason = $2 WHERE id = $3 RETURNING *",
      [status, rejection_reason, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { requestEquipment, getAllRequests, updateRequestStatus };