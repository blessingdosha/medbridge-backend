/**
 * Single source of truth for development data.
 * Resets and repopulates tables used by the current API:
 * users, hospitals, laboratories, facilities, equipment, equipment_requests,
 * equipment_request_results.
 *
 * Run: npm run seed
 * Requires .env DB_* variables. Destructive: truncates the tables above.
 */

const bcrypt = require("bcryptjs");
const pool = require("./db");

async function seed() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      TRUNCATE TABLE
        equipment_request_results,
        equipment_requests,
        equipment,
        facilities,
        laboratories,
        hospitals,
        users
      RESTART IDENTITY CASCADE
    `);

    const demoPassword = await bcrypt.hash("Password123!", 10);
    await client.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1, $2, $3, $4)`,
      [
        "Demo Physician",
        "doctor@medbridge.demo",
        demoPassword,
        "physician",
      ],
    );

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

    for (const h of hospitals) {
      await client.query(
        `INSERT INTO hospitals (name, location, contact_email, contact_phone, facility_type, latitude, longitude)
         VALUES ($1, $2, $3, $4, 'hospital', $5, $6)`,
        [
          h.name,
          h.location,
          h.contact_email,
          h.contact_phone,
          h.latitude,
          h.longitude,
        ],
      );
    }

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

    for (const l of laboratories) {
      await client.query(
        `INSERT INTO laboratories (name, location, contact_email, contact_phone, facility_type, latitude, longitude, services)
         VALUES ($1, $2, $3, $4, 'laboratory', $5, $6, $7)`,
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
    }

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
    ];

    for (const f of facilities) {
      await client.query(
        `INSERT INTO facilities (name, address, contact_email, contact_phone, facility_type, latitude, longitude, services)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
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

    const { rows: facilityRows } = await client.query(
      "SELECT id, name FROM facilities ORDER BY id",
    );
    const facilityId = Object.fromEntries(
      facilityRows.map((r) => [r.name, r.id]),
    );

    const equipmentRows = [
      {
        name: "MRI Scanner",
        type: "Imaging",
        facility: "West Diagnostic Facility",
        availability: true,
      },
      {
        name: "CT Scanner",
        type: "Imaging",
        facility: "Sunrise Facility",
        availability: true,
      },
      {
        name: "X-Ray Machine",
        type: "Imaging",
        facility: "East Health Facility",
        availability: false,
      },
      {
        name: "Ultrasound Machine",
        type: "Imaging",
        facility: "Lakeside Facility",
        availability: true,
      },
      {
        name: "Ventilator",
        type: "Respiratory",
        facility: "East Health Facility",
        availability: true,
      },
      {
        name: "Defibrillator",
        type: "Cardiac",
        facility: "General Facility",
        availability: true,
      },
      {
        name: "ECG Machine",
        type: "Cardiac",
        facility: "St. Mary Facility",
        availability: true,
      },
      {
        name: "Patient Monitor",
        type: "Monitoring",
        facility: "Harbor Facility",
        availability: true,
      },
      {
        name: "Blood Analyzer",
        type: "Laboratory",
        facility: "Central Lab Facility",
        availability: true,
      },
      {
        name: "Microscope Station",
        type: "Laboratory",
        facility: "North Path Facility",
        availability: false,
      },
      {
        name: "Dialysis Machine",
        type: "Other",
        facility: "Metro Facility",
        availability: true,
      },
      {
        name: "Portable X-Ray",
        type: "Imaging",
        facility: "West Diagnostic Facility",
        availability: true,
      },
    ];

    const equipmentIdsByName = {};
    for (const e of equipmentRows) {
      const fid = facilityId[e.facility];
      if (!fid) {
        throw new Error(`Unknown facility for equipment: ${e.facility}`);
      }
      const ins = await client.query(
        `INSERT INTO equipment (name, type, facility_id, availability)
         VALUES ($1, $2, $3, $4) RETURNING id, name`,
        [e.name, e.type, fid, e.availability],
      );
      equipmentIdsByName[e.name] = ins.rows[0].id;
    }

    const fromEast = facilityId["East Health Facility"];
    const toWest = facilityId["West Diagnostic Facility"];
    const fromGeneral = facilityId["General Facility"];
    const toLakeside = facilityId["Lakeside Facility"];
    const fromCentral = facilityId["Central Lab Facility"];
    const toHarbor = facilityId["Harbor Facility"];
    const fromStMary = facilityId["St. Mary Facility"];
    const toMetro = facilityId["Metro Facility"];

    const requestInserts = [
      {
        equipment_id: equipmentIdsByName["Ventilator"],
        from_facility: fromEast,
        to_facility: toWest,
        notes: "Urgent ICU ventilator share",
        status: "pending",
        quantity: 1,
      },
      {
        equipment_id: equipmentIdsByName["MRI Scanner"],
        from_facility: fromGeneral,
        to_facility: toLakeside,
        notes: "MRI required for diagnosis",
        status: "approved",
        quantity: 1,
      },
      {
        equipment_id: equipmentIdsByName["X-Ray Machine"],
        from_facility: fromCentral,
        to_facility: toHarbor,
        notes: "Trauma bay imaging backup",
        status: "rejected",
        quantity: 2,
      },
      {
        equipment_id: equipmentIdsByName["Ultrasound Machine"],
        from_facility: fromStMary,
        to_facility: toMetro,
        notes: "Maternity ward ultrasound",
        status: "pending",
        quantity: 1,
      },
      {
        equipment_id: equipmentIdsByName["Patient Monitor"],
        from_facility: toLakeside,
        to_facility: fromEast,
        notes: "Post-op monitoring loan",
        status: "results-sent",
        quantity: 3,
      },
    ];

    let resultsSentRequestId = null;
    for (const r of requestInserts) {
      const res = await client.query(
        `INSERT INTO equipment_requests (equipment_id, notes, from_facility, to_facility, status, quantity)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          r.equipment_id,
          r.notes,
          r.from_facility,
          r.to_facility,
          r.status,
          r.quantity,
        ],
      );
      if (r.status === "results-sent") {
        resultsSentRequestId = res.rows[0].id;
      }
    }

    if (resultsSentRequestId != null) {
      await client.query(
        `INSERT INTO equipment_request_results (equipment_request_id, diagnosis_findings, notes_report, attachment)
         VALUES ($1, $2, $3, $4)`,
        [
          resultsSentRequestId,
          "Vital signs stable; monitoring data reviewed.",
          "Shared patient monitor returned with full telemetry export. No device faults reported.",
          null,
        ],
      );
    }

    await client.query("COMMIT");
    console.log("Seed completed.");
    console.log("Demo login: doctor@medbridge.demo / Password123!");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
