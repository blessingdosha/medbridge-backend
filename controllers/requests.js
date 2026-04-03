const pool = require("../db");

// Create a new equipment request
const requestEquipment = async (req, res) => {
  const { equipment_id, notes, from_facility, to_facility, status, quantity } =
    req.body;
  try {
    const insertResult = await pool.query(
      `INSERT INTO equipment_requests (equipment_id, notes, from_facility, to_facility, status, quantity)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        equipment_id,
        notes,
        from_facility,
        to_facility,
        status || "pending",
        quantity || 1,
      ],
    );
    const request = insertResult.rows[0];
    // Fetch with facility and equipment details
    const result = await pool.query(
      `SELECT er.*, 
              rf.name AS from_facility_name, 
              tf.name AS to_facility_name, 
              e.name AS equipment_name
       FROM equipment_requests er
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       WHERE er.id = $1`,
      [request.id],
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
      `SELECT er.*, 
              rf.name AS from_facility_name, 
              tf.name AS to_facility_name, 
              e.name AS equipment_name
       FROM equipment_requests er
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       LEFT JOIN equipment e ON er.equipment_id = e.id`,
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
      [status, rejection_reason, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send or update results for an approved request
const sendRequestResult = async (req, res) => {
  const { id } = req.params;
  const { diagnosis_findings, notes_report, attachment } = req.body;
  const uploadedAttachment = req.file
    ? `/uploads/${req.file.filename}`
    : attachment || null;

  if (!diagnosis_findings || !notes_report) {
    return res
      .status(400)
      .json({ error: "diagnosis_findings and notes_report are required" });
  }

  try {
    const requestCheck = await pool.query(
      "SELECT id, status FROM equipment_requests WHERE id = $1",
      [id],
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (requestCheck.rows[0].status !== "approved") {
      return res
        .status(400)
        .json({ error: "Results can only be sent for approved requests" });
    }

    const existingResult = await pool.query(
      "SELECT id FROM equipment_request_results WHERE equipment_request_id = $1",
      [id],
    );

    let resultRow;
    if (existingResult.rows.length > 0) {
      const updateResult = await pool.query(
        `UPDATE equipment_request_results
         SET diagnosis_findings = $1, notes_report = $2, attachment = $3, updated_at = NOW()
         WHERE equipment_request_id = $4
         RETURNING *`,
        [diagnosis_findings, notes_report, uploadedAttachment, id],
      );
      resultRow = updateResult.rows[0];
    } else {
      const insertResult = await pool.query(
        `INSERT INTO equipment_request_results (equipment_request_id, diagnosis_findings, notes_report, attachment)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [id, diagnosis_findings, notes_report, uploadedAttachment],
      );
      resultRow = insertResult.rows[0];
    }

    const response = await pool.query(
      `SELECT rr.*, e.name AS equipment_name, rf.name AS from_facility_name, tf.name AS to_facility_name
       FROM equipment_request_results rr
       JOIN equipment_requests er ON rr.equipment_request_id = er.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       WHERE rr.id = $1`,
      [resultRow.id],
    );

    res.status(200).json(response.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get results for a request
const getRequestResult = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT rr.*, e.name AS equipment_name, rf.name AS from_facility_name, tf.name AS to_facility_name
       FROM equipment_request_results rr
       JOIN equipment_requests er ON rr.equipment_request_id = er.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       WHERE rr.equipment_request_id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "No result found for this request" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  requestEquipment,
  getAllRequests,
  updateRequestStatus,
  sendRequestResult,
  getRequestResult,
};
