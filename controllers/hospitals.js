const pool = require("../db");

// Add a hospital
const addHospital = async (req, res) => {
  const { name, location, contact_email, contact_phone, latitude, longitude } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO hospitals (name, location, contact_email, contact_phone, facility_type, latitude, longitude) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *",
      [name, location, contact_email, contact_phone, "hospital", latitude, longitude]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all facilities (hospitals and laboratories)
const getAllFacilities = async (req, res) => {
  try {
    // Query hospitals
    const hospitalsResult = await pool.query(
      "SELECT id, name, location, contact_email, contact_phone, facility_type, latitude, longitude, created_at, NULL::TEXT[] as services FROM hospitals WHERE facility_type = 'hospital'"
    );
    
    // Query laboratories
    const laboratoriesResult = await pool.query(
      "SELECT id, name, location, contact_email, contact_phone, facility_type, latitude, longitude, created_at, services FROM laboratories WHERE facility_type = 'laboratory'"
    );
    
    // Combine results
    const allFacilities = [...hospitalsResult.rows, ...laboratoriesResult.rows];
    res.json(allFacilities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get facilities by type
const getFacilitiesByType = async (req, res) => {
  const { type } = req.query;
  try {
    if (type === 'hospital') {
      const result = await pool.query(
        "SELECT id, name, location, contact_email, contact_phone, facility_type, latitude, longitude, created_at, NULL::TEXT[] as services FROM hospitals WHERE facility_type = 'hospital'"
      );
      res.json(result.rows);
    } else if (type === 'laboratory') {
      const result = await pool.query(
        "SELECT id, name, location, contact_email, contact_phone, facility_type, latitude, longitude, created_at, services FROM laboratories WHERE facility_type = 'laboratory'"
      );
      res.json(result.rows);
    } else {
      res.status(400).json({ error: "Invalid type. Use 'hospital' or 'laboratory'" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get nearby facilities (for map feature)
const getNearbyFacilities = async (req, res) => {
  const { latitude, longitude, radius } = req.query;
  
  // Validate input parameters
  if (!latitude || !longitude || !radius) {
    return res.status(400).json({ error: "Missing required parameters: latitude, longitude, radius" });
  }
  
  try {
    const result = await pool.query(
      `SELECT * FROM (
        SELECT *, 
         (3959 * acos(cos(radians($1)) * cos(radians(latitude)) * cos(radians(longitude) - radians($2)) + sin(radians($1)) * sin(radians(latitude)))) AS distance
        FROM hospitals 
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
      ) AS facilities_with_distance
      WHERE distance < $3
      ORDER BY distance ASC`,
      [latitude, longitude, radius]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addHospital, getAllFacilities, getFacilitiesByType, getNearbyFacilities };