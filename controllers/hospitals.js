const pool = require("../db");

// Add a hospital (directory entry; approved by default for platform-curated records)
const addHospital = async (req, res) => {
  const {
    name,
    location,
    city,
    state,
    contact_email,
    contact_phone,
    latitude,
    longitude,
    license_number,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO hospitals (
        name, location, contact_email, contact_phone, facility_type, latitude, longitude,
        license_number, registration_status, city, state
      ) VALUES ($1, $2, $3, $4, 'hospital', $5, $6, $7, 'approved', $8, $9)
      RETURNING *`,
      [
        name,
        location || [city, state].filter(Boolean).join(", ") || null,
        contact_email,
        contact_phone,
        latitude,
        longitude,
        license_number?.trim() || null,
        city || null,
        state || null,
      ],
    );
    await pool.query(
      `INSERT INTO facilities (
        name, address, contact_email, contact_phone, facility_type, latitude, longitude, services, hospital_id
      ) VALUES ($1, $2, $3, $4, 'hospital', $5, $6, ARRAY[]::text[], $7)`,
      [
        result.rows[0].name,
        result.rows[0].location || null,
        result.rows[0].contact_email || null,
        result.rows[0].contact_phone || null,
        result.rows[0].latitude || null,
        result.rows[0].longitude || null,
        result.rows[0].id,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "License number must be unique" });
    }
    res.status(500).json({ error: err.message });
  }
};

// Get all approved hospitals for application directory screens.
const getAllHospitals = async (req, res) => {
  try {
    const hospitalsResult = await pool.query(
      `SELECT id, name, location, city, state, contact_email, contact_phone, facility_type,
              latitude, longitude, created_at, license_number, registration_status
       FROM hospitals
       WHERE facility_type = 'hospital'
         AND COALESCE(registration_status, 'approved') = 'approved'
       ORDER BY name ASC`,
    );
    res.json(hospitalsResult.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getHospitalById = async (req, res) => {
  const { id } = req.params;
  try {
    const hospital = await pool.query(
      `SELECT id, name, location, city, state, contact_email, contact_phone, facility_type,
              latitude, longitude, created_at, license_number, registration_status, approved_at
       FROM hospitals
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    if (!hospital.rows[0]) {
      return res.status(404).json({ error: "Hospital not found" });
    }
    const equipment = await pool.query(
      `SELECT e.id, e.name, e.type, e.availability, e.quantity, e.description
       FROM equipment e
       JOIN facilities f ON f.id = e.facility_id
       WHERE f.hospital_id = $1
       ORDER BY e.name ASC`,
      [id],
    );
    const doctors = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE hospital_id = $1
       ORDER BY id ASC`,
      [id],
    );
    res.json({
      ...hospital.rows[0],
      equipment: equipment.rows,
      doctors: doctors.rows,
      equipment_count: equipment.rows.length,
      doctor_count: doctors.rows.length,
    });
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

// Get nearby approved hospitals (for map locator).
const getNearbyHospitals = async (req, res) => {
  const { latitude, longitude, radius } = req.query;

  if (!latitude || !longitude || !radius) {
    return res.status(400).json({
      error: "Missing required parameters: latitude, longitude, radius",
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM (
         SELECT
          h.id, h.name, h.location, h.city, h.state, h.contact_email, h.contact_phone,
          h.facility_type, h.latitude, h.longitude, h.created_at,
          'hospital' AS map_source,
          ${distanceMilesExpr} AS distance
         FROM hospitals h
         WHERE h.latitude IS NOT NULL AND h.longitude IS NOT NULL
           AND COALESCE(h.registration_status, 'approved') = 'approved'
       ) x
       WHERE x.distance < $3::float
       ORDER BY x.distance ASC`,
      [latitude, longitude, radius],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addHospital, getAllHospitals, getHospitalById, getNearbyHospitals };