// seed_equipment_requests.js
const pool = require("./db");

async function getIds(table) {
  const res = await pool.query(`SELECT id FROM ${table}`);
  return res.rows.map((row) => row.id);
}

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedEquipmentRequests() {
  const facilityIds = await getIds("facilities");
  const equipmentIds = await getIds("equipment");
  if (facilityIds.length < 2 || equipmentIds.length < 1) {
    console.error("Not enough facilities or equipment to seed requests.");
    await pool.end();
    return;
  }

  const statuses = ["pending", "approved", "rejected"];
  const notesArr = [
    "Need ventilator urgently",
    "MRI required for diagnosis",
    "X-Ray needed for trauma case",
    "Transfer patient monitor",
    "Request for oxygen concentrator",
    "Blood test supplies needed",
    "CT scan for emergency",
    "Ultrasound for maternity ward",
    "Defibrillator for ER",
    "General equipment restock",
  ];

  try {
    for (let i = 0; i < 10; i++) {
      let from_facility = getRandom(facilityIds);
      let to_facility = getRandom(facilityIds);
      // Ensure from and to are not the same
      while (to_facility === from_facility) {
        to_facility = getRandom(facilityIds);
      }
      const equipment_id = getRandom(equipmentIds);
      const status = getRandom(statuses);
      const quantity = Math.floor(Math.random() * 5) + 1;
      const notes = getRandom(notesArr);
      await pool.query(
        `INSERT INTO equipment_requests (equipment_id, from_facility, to_facility, notes, status, quantity)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [equipment_id, from_facility, to_facility, notes, status, quantity],
      );
    }
    console.log("Equipment requests seeded successfully.");
  } catch (err) {
    console.error("Seeding equipment requests failed:", err);
  } finally {
    await pool.end();
  }
}

seedEquipmentRequests();
