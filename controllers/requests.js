const pool = require("../db");

/** Shared row shape for authorization (facilities optional hospital link). */
async function fetchRequestParties(requestId) {
  const r = await pool.query(
    `SELECT er.id, er.hospital_id, er.status, er.from_facility, er.to_facility, er.equipment_id,
            rf.hospital_id AS from_facility_hospital_id,
            tf.hospital_id AS to_facility_hospital_id
     FROM equipment_requests er
     LEFT JOIN facilities rf ON er.from_facility = rf.id
     LEFT JOIN facilities tf ON er.to_facility = tf.id
     WHERE er.id = $1::integer`,
    [requestId],
  );
  return r.rows[0] || null;
}

/** Whether two booking windows [visit, release] intersect (null release = open-ended). */
function bookingRangesOverlap(aVisit, aEnd, bVisit, bEnd) {
  const sA = new Date(aVisit).getTime();
  const sB = new Date(bVisit).getTime();
  const eA = aEnd ? new Date(aEnd).getTime() : Number.POSITIVE_INFINITY;
  const eB = bEnd ? new Date(bEnd).getTime() : Number.POSITIVE_INFINITY;
  return sA < eB && sB < eA;
}

async function findVisitOverlapWarning(pool, equipmentId, excludeRequestId, visitStart, releaseEnd) {
  const r = await pool.query(
    `SELECT patient_visit_at, equipment_booking_end_at
     FROM equipment_requests
     WHERE equipment_id = $1::integer
       AND id <> $2::integer
       AND status IN ('approved', 'results-sent')
       AND patient_visit_at IS NOT NULL`,
    [equipmentId, excludeRequestId],
  );
  for (const row of r.rows) {
    if (
      bookingRangesOverlap(
        visitStart,
        releaseEnd,
        row.patient_visit_at,
        row.equipment_booking_end_at,
      )
    ) {
      return (
        "This visit window overlaps another approved booking for the same equipment. " +
        "You can keep this schedule; coordinate with the other hospital if needed."
      );
    }
  }
  return null;
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

/** Only the equipment-owning hospital (from_facility) or super_admin can set patient visit. */
async function assertScheduleAccess(req, requestId) {
  const access = await assertRequestAccess(req, requestId);
  if (!access.ok) {
    return access;
  }
  if (!["physician", "hospital_admin", "super_admin"].includes(req.user.role)) {
    return {
      ok: false,
      status: 403,
      error: "Only hospital doctors can schedule patient visits.",
    };
  }
  if (req.user.role === "super_admin") {
    return { ok: true, row: access.row };
  }
  const uid =
    req.user.hospitalId != null ? Number(req.user.hospitalId) : null;
  const fromOrg =
    access.row.from_facility_hospital_id != null
      ? Number(access.row.from_facility_hospital_id)
      : null;
  if (uid != null && fromOrg != null && uid === fromOrg) {
    return { ok: true, row: access.row };
  }
  return {
    ok: false,
    status: 403,
    error: "Only the equipment-owning hospital can set the patient visit.",
  };
}

/** Only equipment-owning hospital (from_facility) or super_admin can approve/reject. */
async function assertDecisionAccess(req, requestId) {
  const access = await assertRequestAccess(req, requestId);
  if (!access.ok) {
    return access;
  }
  if (!["physician", "hospital_admin", "super_admin"].includes(req.user.role)) {
    return {
      ok: false,
      status: 403,
      error: "Only hospital doctors can approve or reject requests.",
    };
  }
  if (req.user.role === "super_admin") {
    return { ok: true, row: access.row };
  }
  const uid =
    req.user.hospitalId != null ? Number(req.user.hospitalId) : null;
  const fromOrg =
    access.row.from_facility_hospital_id != null
      ? Number(access.row.from_facility_hospital_id)
      : null;
  if (uid != null && fromOrg != null && uid === fromOrg) {
    return { ok: true, row: access.row };
  }
  return {
    ok: false,
    status: 403,
    error: "Only the equipment-owning hospital can approve or reject this request.",
  };
}

async function assertResultsAccess(req, requestId) {
  const access = await assertRequestAccess(req, requestId);
  if (!access.ok) {
    return access;
  }
  if (!["physician", "hospital_admin"].includes(req.user.role)) {
    return {
      ok: false,
      status: 403,
      error: "Only hospital doctors can send clinical results.",
    };
  }
  const uid =
    req.user.hospitalId != null ? Number(req.user.hospitalId) : null;
  const fromOrg =
    access.row.from_facility_hospital_id != null
      ? Number(access.row.from_facility_hospital_id)
      : null;
  if (uid != null && fromOrg != null && uid === fromOrg) {
    return { ok: true, row: access.row };
  }
  return {
    ok: false,
    status: 403,
    error: "Only the destination hospital doctor can send clinical results.",
  };
}

async function assertDoctorSideAccess(req, requestId) {
  const access = await assertRequestAccess(req, requestId);
  if (!access.ok) {
    return access;
  }
  if (!["physician", "hospital_admin"].includes(req.user.role)) {
    return {
      ok: false,
      status: 403,
      error: "Doctor-side action only.",
    };
  }
  return access;
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
       WHERE er.id = $1::integer`,
      [request.id],
    );
    const row = result.rows[0];
    let warning = null;
    const busy = await pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM equipment_requests er
        WHERE er.equipment_id = $1::integer
          AND er.status IN ('approved', 'results-sent')
          AND (
            er.equipment_booking_end_at IS NULL
            OR er.equipment_booking_end_at > NOW()
          )
      ) AS x`,
      [equipment_id],
    );
    if (busy.rows[0]?.x) {
      warning =
        "This equipment already has an active approved booking on the network. You can still submit; coordinate timing with the equipment hospital.";
    }
    res.status(201).json(warning ? { ...row, warning } : row);
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
       WHERE er.id = $1::integer`,
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
        er.hospital_id = $1::integer
        OR EXISTS (SELECT 1 FROM facilities tfx WHERE tfx.id = er.to_facility AND tfx.hospital_id = $1::integer)
        OR EXISTS (SELECT 1 FROM facilities rfx WHERE rfx.id = er.from_facility AND rfx.hospital_id = $1::integer)
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

  const access = await assertDecisionAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }
  if (!["approved", "rejected"].includes(String(status || ""))) {
    return res.status(400).json({
      error: "Invalid status. Only 'approved' or 'rejected' are supported.",
    });
  }
  if (access.row?.status !== "pending") {
    return res.status(400).json({
      error: "Only pending requests can be approved or rejected.",
    });
  }

  try {
    let warning = null;
    if (status === "approved") {
      const dup = await pool.query(
        `SELECT COUNT(*)::int AS c FROM equipment_requests
         WHERE equipment_id = (SELECT equipment_id FROM equipment_requests WHERE id = $1::integer)
           AND status IN ('approved', 'results-sent')
           AND id <> $2::integer`,
        [id, id],
      );
      if ((dup.rows[0]?.c ?? 0) > 0) {
        warning =
          "Another request for this equipment is already approved. Multiple approved bookings may overlap; coordinate visit times.";
      }
    }

    const result = await pool.query(
      `UPDATE equipment_requests
       SET status = $1::text,
           approved_at = CASE WHEN $1::text = 'approved' THEN NOW() ELSE NULL END,
           rejection_reason = CASE WHEN $1::text = 'rejected' THEN $2 ELSE NULL END
       WHERE id = $3::integer
       RETURNING *`,
      [status, rejection_reason?.trim() || null, id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    const row = result.rows[0];
    res.json(warning ? { ...row, warning } : row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const schedulePatientVisit = async (req, res) => {
  const { id } = req.params;
  const {
    patient_visit_at,
    patient_visit_instructions,
    equipment_booking_end_at,
  } = req.body;

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

  if (
    !equipment_booking_end_at ||
    String(equipment_booking_end_at).trim() === ""
  ) {
    return res.status(400).json({ error: "equipment_booking_end_at is required" });
  }

  const visitDate = new Date(patient_visit_at);
  if (Number.isNaN(visitDate.getTime())) {
    return res.status(400).json({ error: "Invalid patient_visit_at" });
  }

  const endDate = new Date(equipment_booking_end_at);
  if (Number.isNaN(endDate.getTime())) {
    return res.status(400).json({ error: "Invalid equipment_booking_end_at" });
  }

  if (!(endDate > visitDate)) {
    return res.status(400).json({
      error: "equipment_booking_end_at must be after patient_visit_at",
    });
  }

  const equipmentId = access.row.equipment_id;
  if (equipmentId == null) {
    return res.status(400).json({ error: "Request is missing equipment_id" });
  }

  try {
    const warning = await findVisitOverlapWarning(
      pool,
      equipmentId,
      Number(id),
      visitDate.toISOString(),
      endDate.toISOString(),
    );

    const upd = await pool.query(
      `UPDATE equipment_requests
       SET patient_visit_at = $1,
           patient_visit_instructions = $2,
           equipment_booking_end_at = $3,
           patient_visit_set_at = NOW()
       WHERE id = $4::integer
       RETURNING *`,
      [
        visitDate.toISOString(),
        patient_visit_instructions?.trim() || null,
        endDate.toISOString(),
        id,
      ],
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    const payload = {
      message: "Patient visit saved.",
      request: upd.rows[0],
    };
    if (warning) {
      payload.warning = warning;
    }
    res.json(payload);
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
  if (row.equipment_booking_end_at) {
    lines.push(
      `Equipment available again (network): ${new Date(row.equipment_booking_end_at).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}`,
    );
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

const downloadVisitSummary = async (req, res) => {
  const { id } = req.params;
  const access = await assertDoctorSideAccess(req, id);
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
       WHERE er.id = $1::integer`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    const row = result.rows[0];
    if (!row.patient_visit_at) {
      return res.status(400).json({
        error: "No visit summary yet. Schedule the patient visit first.",
      });
    }

    const visitLines = [
      "MedBridge — Patient visit summary",
      `Request ID: ${row.id}`,
      `Equipment: ${row.equipment_name || "—"}`,
      `From: ${row.from_facility_name || "—"}`,
      `To: ${row.to_facility_name || "—"}`,
      "",
      `Visit time: ${new Date(row.patient_visit_at).toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "short",
      })}`,
      `Instructions: ${row.patient_visit_instructions || "—"}`,
      "",
      row.equipment_booking_end_at
        ? `Equipment available again (network): ${new Date(row.equipment_booking_end_at).toLocaleString(undefined, {
            dateStyle: "full",
            timeStyle: "short",
          })}`
        : "",
      "",
      "— Generated by MedBridge",
    ].filter((line) => line !== "");
    const text = visitLines.join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="medbridge-request-${id}-visit-summary.txt"`,
    );
    res.send(text);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const downloadClinicalResult = async (req, res) => {
  const { id } = req.params;
  const access = await assertDoctorSideAccess(req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  try {
    const result = await pool.query(
      `SELECT er.id, e.name AS equipment_name, rf.name AS from_facility_name, tf.name AS to_facility_name,
              err.diagnosis_findings AS result_diagnosis_findings,
              err.notes_report AS result_notes_report,
              err.attachment AS result_attachment
       FROM equipment_requests er
       LEFT JOIN facilities rf ON er.from_facility = rf.id
       LEFT JOIN facilities tf ON er.to_facility = tf.id
       LEFT JOIN equipment e ON er.equipment_id = e.id
       LEFT JOIN equipment_request_results err ON err.equipment_request_id = er.id
       WHERE er.id = $1::integer`,
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Request not found" });
    }
    const row = result.rows[0];
    if (!row.result_diagnosis_findings && !row.result_notes_report) {
      return res.status(400).json({
        error: "No clinical result yet. Send clinical results first.",
      });
    }

    const resultLines = [
      "MedBridge — Clinical result",
      `Request ID: ${row.id}`,
      `Equipment: ${row.equipment_name || "—"}`,
      `From: ${row.from_facility_name || "—"}`,
      `To: ${row.to_facility_name || "—"}`,
      "",
      `Findings: ${row.result_diagnosis_findings || "—"}`,
      `Notes: ${row.result_notes_report || "—"}`,
      `Attachment: ${row.result_attachment || "—"}`,
      "",
      "— Generated by MedBridge",
    ];
    const text = resultLines.join("\n");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="medbridge-request-${id}-clinical-result.txt"`,
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

  const access = await assertResultsAccess(req, id);
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
      "SELECT id, status FROM equipment_requests WHERE id = $1::integer",
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
      "SELECT id FROM equipment_request_results WHERE equipment_request_id = $1::integer",
      [id],
    );

    let resultRow;
    if (existingResult.rows.length > 0) {
      const updateResult = await pool.query(
        `UPDATE equipment_request_results
         SET diagnosis_findings = $1, notes_report = $2, attachment = $3, updated_at = NOW()
         WHERE equipment_request_id = $4::integer
         RETURNING *`,
        [diagnosis_findings, notes_report, uploadedAttachment, id],
      );
      resultRow = updateResult.rows[0];
    } else {
      const insertResult = await pool.query(
        `INSERT INTO equipment_request_results (equipment_request_id, diagnosis_findings, notes_report, attachment)
         VALUES ($1::integer, $2, $3, $4)
         RETURNING *`,
        [id, diagnosis_findings, notes_report, uploadedAttachment],
      );
      resultRow = insertResult.rows[0];
    }

    await pool.query(
      `UPDATE equipment_requests SET status = 'results-sent' WHERE id = $1::integer`,
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

  const access = await assertDoctorSideAccess(req, id);
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
       WHERE rr.equipment_request_id = $1::integer`,
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
  downloadVisitSummary,
  downloadClinicalResult,
  sendRequestResult,
  getRequestResult,
};
