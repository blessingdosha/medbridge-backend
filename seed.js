// seed.js
// Run with: npm run seed

const pool = require("./db");

async function seed() {
  try {
    // 1. Seed hospitals
    const hospitals = [
      {
        name: "General Hospital",
        location: "City Center",
        contact_email: "genhosp@example.com",
        contact_phone: "1234567890",
        latitude: 40.7128,
        longitude: -74.006,
      },
      {
        name: "St. Mary Clinic",
        location: "North District",
        contact_email: "maryclinic@example.com",
        contact_phone: "2345678901",
        latitude: 40.7138,
        longitude: -74.005,
      },
      {
        name: "Sunrise Medical",
        location: "East Side",
        contact_email: "sunrise@example.com",
        contact_phone: "3456789012",
        latitude: 40.7148,
        longitude: -74.004,
      },
      {
        name: "Westside Health",
        location: "West End",
        contact_email: "westside@example.com",
        contact_phone: "4567890123",
        latitude: 40.7158,
        longitude: -74.003,
      },
      {
        name: "Lakeside Hospital",
        location: "Lakeside",
        contact_email: "lakeside@example.com",
        contact_phone: "5678901234",
        latitude: 40.7168,
        longitude: -74.002,
      },
    ];
    const hospitalIds = [];
    for (const h of hospitals) {
      const res = await pool.query(
        "INSERT INTO hospitals (name, location, contact_email, contact_phone, facility_type, latitude, longitude) VALUES ($1, $2, $3, $4, 'hospital', $5, $6) RETURNING id",
        [
          h.name,
          h.location,
          h.contact_email,
          h.contact_phone,
          h.latitude,
          h.longitude,
        ],
      );
      hospitalIds.push(res.rows[0].id);
    }

    // 2. Seed laboratories
    const laboratories = [
      {
        name: "Central Lab",
        location: "City Center",
        contact_email: "centrallab@example.com",
        contact_phone: "6789012345",
        latitude: 40.7129,
        longitude: -74.0061,
        services: ["Blood Test", "Urine Test"],
      },
      {
        name: "East Diagnostics",
        location: "East Side",
        contact_email: "eastdiag@example.com",
        contact_phone: "7890123456",
        latitude: 40.7139,
        longitude: -74.0051,
        services: ["X-Ray", "MRI"],
      },
      {
        name: "West Labs",
        location: "West End",
        contact_email: "westlabs@example.com",
        contact_phone: "8901234567",
        latitude: 40.7149,
        longitude: -74.0041,
        services: ["CT Scan"],
      },
      {
        name: "North Pathology",
        location: "North District",
        contact_email: "northpath@example.com",
        contact_phone: "9012345678",
        latitude: 40.7159,
        longitude: -74.0031,
        services: ["Biopsy"],
      },
      {
        name: "Lakeside Diagnostics",
        location: "Lakeside",
        contact_email: "lakesidediag@example.com",
        contact_phone: "1234509876",
        latitude: 40.7169,
        longitude: -74.0021,
        services: ["Blood Test"],
      },
    ];
    const laboratoryIds = [];
    for (const l of laboratories) {
      const res = await pool.query(
        "INSERT INTO laboratories (name, location, contact_email, contact_phone, facility_type, latitude, longitude, services) VALUES ($1, $2, $3, $4, 'laboratory', $5, $6, $7) RETURNING id",
        [
          l.name,
          l.location,
          l.contact_email,
          l.contact_phone,
          l.latitude,
          l.longitude,
          l.services,
        ],
      );
      laboratoryIds.push(res.rows[0].id);
    }

    // 3. Seed equipment
    const equipment = [
      {
        name: "Ventilator",
        type: "Respiratory",
        hospital_id: hospitalIds[0],
        availability: true,
        description: "Advanced ventilator",
      },
      {
        name: "MRI Scanner",
        type: "Imaging",
        hospital_id: hospitalIds[1],
        availability: true,
        description: "High-res MRI",
      },
      {
        name: "X-Ray Machine",
        type: "Imaging",
        hospital_id: hospitalIds[2],
        availability: false,
        description: "Digital X-Ray",
      },
      {
        name: "Ultrasound",
        type: "Imaging",
        hospital_id: hospitalIds[3],
        availability: true,
        description: "Portable ultrasound",
      },
      {
        name: "Defibrillator",
        type: "Cardiac",
        hospital_id: hospitalIds[4],
        availability: true,
        description: "Automated defibrillator",
      },
      {
        name: "ECG Machine",
        type: "Cardiac",
        hospital_id: hospitalIds[0],
        availability: false,
        description: "12-lead ECG",
      },
      {
        name: "Infusion Pump",
        type: "IV",
        hospital_id: hospitalIds[1],
        availability: true,
        description: "Smart infusion pump",
      },
      {
        name: "Patient Monitor",
        type: "Monitoring",
        hospital_id: hospitalIds[2],
        availability: true,
        description: "Multi-parameter monitor",
      },
      {
        name: "Syringe Pump",
        type: "IV",
        hospital_id: hospitalIds[3],
        availability: false,
        description: "Precision syringe pump",
      },
      {
        name: "Oxygen Concentrator",
        type: "Respiratory",
        hospital_id: hospitalIds[4],
        availability: true,
        description: "Portable oxygen concentrator",
      },
    ];
    const equipmentIds = [];
    for (const e of equipment) {
      const res = await pool.query(
        "INSERT INTO equipment (name, type, hospital_id, availability, description) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [e.name, e.type, e.hospital_id, e.availability, e.description],
      );
      equipmentIds.push(res.rows[0].id);
    }

    // 4. Seed equipment requests
    const requests = [
      {
        requesting_hospital_id: hospitalIds[1],
        equipment_id: equipmentIds[0],
        notes: "Urgent need for ventilator",
      },
      {
        requesting_hospital_id: hospitalIds[2],
        equipment_id: equipmentIds[1],
        notes: "MRI required for diagnosis",
      },
      {
        requesting_hospital_id: hospitalIds[3],
        equipment_id: equipmentIds[2],
        notes: "X-Ray needed for trauma case",
      },
      {
        requesting_hospital_id: hospitalIds[4],
        equipment_id: equipmentIds[3],
        notes: "Ultrasound for maternity ward",
      },
      {
        requesting_hospital_id: hospitalIds[0],
        equipment_id: equipmentIds[4],
        notes: "Defibrillator for ER",
      },
    ];
    for (const r of requests) {
      await pool.query(
        "INSERT INTO equipment_requests (requesting_hospital_id, equipment_id, notes) VALUES ($1, $2, $3)",
        [r.requesting_hospital_id, r.equipment_id, r.notes],
      );
    }

    console.log("Seeding completed successfully.");
  } catch (err) {
    console.error("Seeding failed:", err);
  } finally {
    await pool.end();
  }
}

seed();
