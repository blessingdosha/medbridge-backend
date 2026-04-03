// controllers/facilities.js
const pool = require("../db");

// Add a facility
const addFacility = async (req, res) => {
  const { name, address, contact_phone, facility_type } = req.body;
  // Randomize other fields
  const randomEmail = `${name.toLowerCase().replace(/\s+/g, "")}${Math.floor(Math.random() * 1000)}@example.com`;
  const randomLatitude = 40 + Math.random();
  const randomLongitude = -74 - Math.random();
  const serviceOptions = [
    ["Blood Test", "Urine Test"],
    ["X-Ray", "MRI"],
    ["Emergency", "Surgery"],
    ["Biopsy"],
    ["Cardiology"],
    ["CT Scan"],
    ["Pediatrics"],
    ["General Medicine"],
    ["Orthopedics"],
    ["Pathology"],
    ["Neurology"],
    ["Genetics"],
    ["Dermatology"],
    ["Toxicology"],
  ];
  const randomServices =
    serviceOptions[Math.floor(Math.random() * serviceOptions.length)];
  try {
    const result = await pool.query(
      "INSERT INTO facilities (name, address, contact_email, contact_phone, facility_type, latitude, longitude, services) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *",
      [
        name,
        address,
        randomEmail,
        contact_phone,
        facility_type,
        randomLatitude,
        randomLongitude,
        randomServices,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all facilities
const getFacilities = async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM facilities");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addFacility, getFacilities };
