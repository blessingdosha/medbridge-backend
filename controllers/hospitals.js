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

// Haversine distance in miles (Postgres), clamped for numeric safety
const distanceMilesExpr = `(
  3959 * acos(
    least(1::float, greatest(-1::float,
      cos(radians($1::float)) * cos(radians(latitude::float)) * cos(radians(longitude::float) - radians($2::float))
      + sin(radians($1::float)) * sin(radians(latitude::float))
    ))
  )
)`;

// Get nearby hospitals and laboratories (for map / locator)
const getNearbyFacilities = async (req, res) => {
  const { latitude, longitude, radius } = req.query;

  if (!latitude || !longitude || !radius) {
    return res.status(400).json({
      error: "Missing required parameters: latitude, longitude, radius",
    });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM (
        SELECT
          h.id,
          h.name,
          h.location,
          h.contact_email,
          h.contact_phone,
          h.facility_type,
          h.latitude,
          h.longitude,
          h.created_at,
          NULL::TEXT[] AS services,
          'hospital' AS map_source,
          ${distanceMilesExpr} AS distance
        FROM hospitals h
        WHERE h.latitude IS NOT NULL AND h.longitude IS NOT NULL
        UNION ALL
        SELECT
          l.id,
          l.name,
          l.location,
          l.contact_email,
          l.contact_phone,
          l.facility_type,
          l.latitude,
          l.longitude,
          l.created_at,
          l.services,
          'laboratory' AS map_source,
          ${distanceMilesExpr} AS distance
        FROM laboratories l
        WHERE l.latitude IS NOT NULL AND l.longitude IS NOT NULL
      ) AS combined
      WHERE distance < $3::float
      ORDER BY distance ASC`,
      [latitude, longitude, radius],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addHospital, getAllFacilities, getFacilitiesByType, getNearbyFacilities };