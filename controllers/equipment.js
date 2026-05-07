const pool = require("../db");

async function ensureHospitalFacility(hospitalId) {
  const existing = await pool.query(
    `SELECT id FROM facilities
     WHERE hospital_id = $1
     ORDER BY id ASC
     LIMIT 1`,
    [hospitalId],
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }
  const hosp = await pool.query(
    `SELECT id, name, location, contact_email, contact_phone, latitude, longitude
     FROM hospitals WHERE id = $1 LIMIT 1`,
    [hospitalId],
  );
  if (!hosp.rows[0]) return null;
  const created = await pool.query(
    `INSERT INTO facilities (
      name, address, contact_email, contact_phone, facility_type, latitude, longitude, services, hospital_id
    ) VALUES ($1, $2, $3, $4, 'hospital', $5, $6, ARRAY[]::text[], $7)
    RETURNING id`,
    [
      hosp.rows[0].name,
      hosp.rows[0].location || null,
      hosp.rows[0].contact_email || null,
      hosp.rows[0].contact_phone || null,
      hosp.rows[0].latitude || null,
      hosp.rows[0].longitude || null,
      hosp.rows[0].id,
    ],
  );
  return created.rows[0].id;
}

const addEquipment = async (req, res) => {
  const { name, type, availability } = req.body;
  const hospitalId = req.user?.hospitalId;
  if (!hospitalId) {
    return res.status(400).json({ error: "Hospital context is required" });
  }
  try {
    const facilityId = await ensureHospitalFacility(hospitalId);
    if (!facilityId) {
      return res.status(404).json({ error: "Hospital not found for this account" });
    }
    const insertResult = await pool.query(
      "INSERT INTO equipment (name, type, facility_id, availability) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, type, facilityId, availability],
    );
    const equipment = insertResult.rows[0];
    // Fetch with facility name
    const result = await pool.query(
      `SELECT e.*, f.name AS facility_name, f.hospital_id, h.name AS hospital_name
       FROM equipment e
       JOIN facilities f ON e.facility_id = f.id
       LEFT JOIN hospitals h ON f.hospital_id = h.id
       WHERE e.id = $1`,
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
      `SELECT e.*, f.name AS facility_name, f.hospital_id, h.name AS hospital_name
       FROM equipment e
       JOIN facilities f ON e.facility_id = f.id
       LEFT JOIN hospitals h ON f.hospital_id = h.id`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addEquipment, getAvailableEquipment };
