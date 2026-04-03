// seed_facilities.js
const pool = require("./db");

async function seedFacilities() {
  const facilities = [
    {
      name: "Central Lab Facility",
      address: "City Center",
      contact_email: "centrallabfac@example.com",
      contact_phone: "1111111111",
      facility_type: "laboratory",
      latitude: 40.7121,
      longitude: -74.0011,
      services: ["Blood Test", "Urine Test"],
    },
    {
      name: "West Diagnostic Facility",
      address: "West End",
      contact_email: "westdiagfac@example.com",
      contact_phone: "2222222222",
      facility_type: "laboratory",
      latitude: 40.7132,
      longitude: -74.0022,
      services: ["X-Ray", "MRI"],
    },
    {
      name: "East Health Facility",
      address: "East Side",
      contact_email: "easthealthfac@example.com",
      contact_phone: "3333333333",
      facility_type: "hospital",
      latitude: 40.7143,
      longitude: -74.0033,
      services: ["Emergency", "Surgery"],
    },
    {
      name: "North Path Facility",
      address: "North District",
      contact_email: "northpathfac@example.com",
      contact_phone: "4444444444",
      facility_type: "laboratory",
      latitude: 40.7154,
      longitude: -74.0044,
      services: ["Biopsy"],
    },
    {
      name: "Lakeside Facility",
      address: "Lakeside",
      contact_email: "lakesidefac@example.com",
      contact_phone: "5555555555",
      facility_type: "hospital",
      latitude: 40.7165,
      longitude: -74.0055,
      services: ["Cardiology"],
    },
    {
      name: "Sunrise Facility",
      address: "East Side",
      contact_email: "sunrisefac@example.com",
      contact_phone: "6666666666",
      facility_type: "laboratory",
      latitude: 40.7176,
      longitude: -74.0066,
      services: ["CT Scan"],
    },
    {
      name: "Westside Facility",
      address: "West End",
      contact_email: "westsidefac@example.com",
      contact_phone: "7777777777",
      facility_type: "hospital",
      latitude: 40.7187,
      longitude: -74.0077,
      services: ["Pediatrics"],
    },
    {
      name: "General Facility",
      address: "City Center",
      contact_email: "generalfac@example.com",
      contact_phone: "8888888888",
      facility_type: "hospital",
      latitude: 40.7198,
      longitude: -74.0088,
      services: ["General Medicine"],
    },
    {
      name: "St. Mary Facility",
      address: "North District",
      contact_email: "maryfac@example.com",
      contact_phone: "9999999999",
      facility_type: "hospital",
      latitude: 40.7209,
      longitude: -74.0099,
      services: ["Orthopedics"],
    },
    {
      name: "Sunset Facility",
      address: "West End",
      contact_email: "sunsetfac@example.com",
      contact_phone: "1010101010",
      facility_type: "laboratory",
      latitude: 40.721,
      longitude: -74.01,
      services: ["Pathology"],
    },
    {
      name: "Harbor Facility",
      address: "Lakeside",
      contact_email: "harborfac@example.com",
      contact_phone: "1212121212",
      facility_type: "hospital",
      latitude: 40.7221,
      longitude: -74.0111,
      services: ["Neurology"],
    },
    {
      name: "Metro Facility",
      address: "City Center",
      contact_email: "metrofac@example.com",
      contact_phone: "1313131313",
      facility_type: "laboratory",
      latitude: 40.7232,
      longitude: -74.0122,
      services: ["Genetics"],
    },
    {
      name: "Greenfield Facility",
      address: "East Side",
      contact_email: "greenfieldfac@example.com",
      contact_phone: "1414141414",
      facility_type: "hospital",
      latitude: 40.7243,
      longitude: -74.0133,
      services: ["Dermatology"],
    },
    {
      name: "River Facility",
      address: "Lakeside",
      contact_email: "riverfac@example.com",
      contact_phone: "1515151515",
      facility_type: "laboratory",
      latitude: 40.7254,
      longitude: -74.0144,
      services: ["Toxicology"],
    },
  ];

  try {
    for (const f of facilities) {
      await pool.query(
        "INSERT INTO facilities (name, address, contact_email, contact_phone, facility_type, latitude, longitude, services) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
        [
          f.name,
          f.address,
          f.contact_email,
          f.contact_phone,
          f.facility_type,
          f.latitude,
          f.longitude,
          f.services,
        ],
      );
    }
    console.log("Facilities seeded successfully.");
  } catch (err) {
    console.error("Seeding facilities failed:", err);
  } finally {
    await pool.end();
  }
}

seedFacilities();
