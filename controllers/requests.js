const pool = require("../db");

/** Shared row shape for authorization (facilities optional hospital link). */
async function fetchRequestParties(requestId) {
  const r = await pool.query(
    `SELECT er.id, er.hospital_id, er.status, er.from_facility, er.to_facility,
            rf.hospital_id AS from_facility_hospital_id,
            tf.hospital_id AS to_facility_hospital_id
     FROM equipment_requests er
     LEFT JOIN facilities rf ON er.from_facility = rf.id
     LEFT JOIN facilities tf ON er.to_facility = tf.id
     WHERE er.id = $1`,
    [requestId],
  );
  return r.rows[0] || null;
}

async function assertRequestAccess(req, requestId) {
  const row = await fetchRequestParties(requestId);
  if (!row) {
    return { ok: false, status: 404, error: "Request not found" };
  }

  const role = req.user.role;
  const uid =
    req.user.hospitalId != null ? Number(req.user.hospitalId) : null;

  if (role === "super_admin") {
    return { ok: true, row };
  }

  const reqOrg =
    row.hospital_id != null ? Number(row.hospital_id) : null;
  const fromOrg =
    row.from_facility_hospital_id != null
      ? Number(row.from_facility_hospital_id)
      : null;
  const toOrg =
    row.to_facility_hospital_id != null
      ? Number(row.to_facility_hospital_id)
      : null;

  if (uid == null) {
    return { ok: false, status: 403, error: "Not allowed to access this request" };
  }

  if (reqOrg != null && uid === reqOrg) {
    return { ok: true, row };
  }
  if (toOrg != null && uid === toOrg) {
    return { ok: true, row };
  }
  if (fromOrg != null && uid === fromOrg) {
    return { ok: true, row };
  }

  return { ok: false, status: 403, error: "Not allowed to access this request" };
}

async function ensureHospitalFacility(hospitalId) {
  if (hospitalId == null) return null;
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
      hospitalId,
    ],
  );
  return created.rows[0].id;
}

/** Only the receiving facility’s hospital (or super_admin) can set patient visit. */
async function assertScheduleAccess(req, requestId) {
  const access = await assertRequestAccess(req, requestId);
  if (!access.ok) {
    return access;
  }
  if (req.user.role === "super_admin") {
    return { ok: true, row: access.row };
  }
  const uid =
    req.user.hospitalId != null ? Number(req.user.hospitalId) : null;
  const toOrg =
    access.row.to_facility_hospital_id != null
      ? Number(access.row.to_facility_hospital_id)
      : null;
  if (uid != null && toOrg != null && uid === toOrg) {
    return { ok: true, row: access.row };
  }
  return {
    ok: false,
    status: 403,
    error: "Only the receiving hospital can set the patient visit.",
  };
}

// Create a new equipment request
const requestEquipment = async (req, res) => {
  const { equipment_id, notes, from_facility, to_facility, from_hospital_id, status, quantity } =
    req.body;
  const hospitalId =
    req.user.role === "super_admin" ? null : req.user.hospitalId ?? null;
  const createdBy = req.user.id;

  try {
    const fromFacilityId =
      from_facility ??
      (from_hospital_id ? await ensureHospitalFacility(Number(from_hospital_id)) : null);
    const toFacilityId =
      to_facility ??
      (hospitalId != null ? await ensureHospitalFacility(Number(hospitalId)) : null);
    if (!fromFacilityId || !toFacilityId) {
      return res.status(400).json({
        error:
          "Could not resolve source or destination hospital facility for this request.",
      });
    }

    const insertResult = await pool.query(
      `INSERT INTO equipment_requests (
        equipment_id, notes, from_facility, to_facility, status, quantity,
        hospital_id, created_by_user_id
      )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        equipment_id,
        notes,
        fromFacilityId,
        toFacilityId,
        status || "pending",
        quantity || 1,
        hospitalId,
        createdBy,
      ],
    );
    const request = insertResult.rows[0];
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

const getRequestById = async (req, res) => {
  const { id } = req.params;
  const access = await assertRequestAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }
  try {
    const result = await pool.query(
      `SELECT er.*, 
              rf.name AS from_facility_name, 
              tf.name AS to_facility_name, 
              e.name AS equipment_name,
              rf.hospital_id AS from_facility_hospital_id,
              tf.hospital_id AS to_facility_hospital_id,
              err.diagnosis_findings AS result_diagnosis_findings,
              err.notes_report AS result_notes_report,
              err.attachment AS result_attachment,
              (err.id IS NOT NULL) AS has_clinical_result
       FROM equipment_requests er
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       LEFT JOIN equipment_request_results err ON err.equipment_request_id = er.id
       WHERE er.id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllRequests = async (req, res) => {
  try {
    const role = req.user.role;
    const hospitalId = req.user.hospitalId;

    let sql = `SELECT er.*, 
              rf.name AS from_facility_name, 
              tf.name AS to_facility_name, 
              e.name AS equipment_name,
              rf.hospital_id AS from_facility_hospital_id,
              tf.hospital_id AS to_facility_hospital_id,
              err.diagnosis_findings AS result_diagnosis_findings,
              err.notes_report AS result_notes_report,
              err.attachment AS result_attachment,
              (err.id IS NOT NULL) AS has_clinical_result
       FROM equipment_requests er
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       LEFT JOIN equipment_request_results err ON err.equipment_request_id = er.id`;
    const params = [];
    if (role !== "super_admin") {
      sql += ` WHERE (
        er.hospital_id = $1
        OR EXISTS (SELECT 1 FROM facilities tfx WHERE tfx.id = er.to_facility AND tfx.hospital_id = $1)
        OR EXISTS (SELECT 1 FROM facilities rfx WHERE rfx.id = er.from_facility AND rfx.hospital_id = $1)
      )`;
      params.push(hospitalId);
    }
    sql += " ORDER BY er.created_at DESC NULLS LAST, er.id DESC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status, rejection_reason } = req.body;

  const access = await assertRequestAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

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

const schedulePatientVisit = async (req, res) => {
  const { id } = req.params;
  const { patient_visit_at, patient_visit_instructions } = req.body;

  const access = await assertScheduleAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const st = access.row?.status;
  if (st !== "approved" && st !== "results-sent") {
    return res.status(400).json({
      error:
        "Patient visit can only be scheduled after the request is approved.",
    });
  }

  if (!patient_visit_at || String(patient_visit_at).trim() === "") {
    return res.status(400).json({ error: "patient_visit_at is required" });
  }

  const visitDate = new Date(patient_visit_at);
  if (Number.isNaN(visitDate.getTime())) {
    return res.status(400).json({ error: "Invalid patient_visit_at" });
  }

  try {
    const upd = await pool.query(
      `UPDATE equipment_requests
       SET patient_visit_at = $1,
           patient_visit_instructions = $2,
           patient_visit_set_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        visitDate.toISOString(),
        patient_visit_instructions?.trim() || null,
        id,
      ],
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    res.json({
      message: "Patient visit saved.",
      request: upd.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

function buildReportText(row) {
  const lines = [];
  lines.push("MedBridge — Equipment request summary");
  lines.push(`Request ID: ${row.id}`);
  lines.push(`Equipment: ${row.equipment_name || "—"}`);
  lines.push(`From: ${row.from_facility_name || "—"}`);
  lines.push(`To: ${row.to_facility_name || "—"}`);
  lines.push(`Quantity: ${row.quantity ?? "—"}`);
  lines.push(`Status: ${row.status || "—"}`);
  lines.push("");
  if (row.patient_visit_at) {
    const v = new Date(row.patient_visit_at);
    lines.push(
      `Patient visit (scheduled): ${v.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}`,
    );
  } else {
    lines.push("Patient visit: not scheduled in MedBridge");
  }
  if (row.patient_visit_instructions) {
    lines.push(`Instructions: ${row.patient_visit_instructions}`);
  }
  lines.push("");
  if (row.result_diagnosis_findings || row.result_notes_report) {
    lines.push("Clinical report");
    lines.push(`Findings: ${row.result_diagnosis_findings || "—"}`);
    lines.push(`Notes: ${row.result_notes_report || "—"}`);
    if (row.result_attachment) {
      lines.push(
        `Attachment (server path): ${row.result_attachment} — open from facility records if applicable.`,
      );
    }
  } else {
    lines.push("Clinical report: not yet submitted.");
  }
  lines.push("");
  lines.push("— Generated by MedBridge");
  return lines.join("\n");
}

const downloadRequestReport = async (req, res) => {
  const { id } = req.params;
  const access = await assertRequestAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  try {
    const result = await pool.query(
      `SELECT er.*, 
              rf.name AS from_facility_name, 
              tf.name AS to_facility_name, 
              e.name AS equipment_name,
              err.diagnosis_findings AS result_diagnosis_findings,
              err.notes_report AS result_notes_report,
              err.attachment AS result_attachment
       FROM equipment_requests er
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       LEFT JOIN equipment_request_results err ON err.equipment_request_id = er.id
       WHERE er.id = $1`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    const row = result.rows[0];
    const hasContent =
      row.patient_visit_at ||
      row.result_diagnosis_findings ||
      row.result_notes_report;
    if (!hasContent) {
      return res.status(400).json({
        error:
          "Nothing to download yet. Schedule the patient visit or submit clinical results first.",
      });
    }

    const text = buildReportText(row);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="medbridge-request-${id}-report.txt"`,
    );
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sendRequestResult = async (req, res) => {
  const { id } = req.params;
  const { diagnosis_findings, notes_report, attachment } = req.body;
  const uploadedAttachment = req.file
    ? `/uploads/${req.file.filename}`
    : attachment || null;

  const access = await assertRequestAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

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

    const curStatus = requestCheck.rows[0].status;
    if (curStatus !== "approved" && curStatus !== "results-sent") {
      return res.status(400).json({
        error:
          "Results can only be sent for approved requests (or to update an existing result).",
      });
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

    await pool.query(
      `UPDATE equipment_requests SET status = 'results-sent' WHERE id = $1`,
      [id],
    );

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

const getRequestResult = async (req, res) => {
  const { id } = req.params;

  const access = await assertRequestAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

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
  getRequestById,
  getAllRequests,
  updateRequestStatus,
  schedulePatientVisit,
  downloadRequestReport,
  sendRequestResult,
  getRequestResult,
};
