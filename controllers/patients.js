const pool = require("../db");

function hospitalId(req) {
  const v = req.user.hospitalId;
  return v != null ? Number(v) : null;
}

function isSuperAdmin(req) {
  return req.user.role === "super_admin";
}

function isHospitalStaff(req) {
  const r = req.user.role;
  return (r === "physician" || r === "hospital_admin") && hospitalId(req) != null;
}

async function canViewPatient(client, req, patientId) {
  const pid = Number(patientId);
  if (Number.isNaN(pid)) return { ok: false, status: 400, error: "Invalid id" };

  const pr = await client.query(
    `SELECT p.id, p.hospital_id, p.first_name, p.last_name, p.external_reference,
            p.date_of_birth, p.gender, p.phone, p.clinical_summary, p.attachment_path,
            p.created_at, p.updated_at, p.created_by_user_id,
            h.name AS owning_hospital_name
     FROM patients p
     JOIN hospitals h ON h.id = p.hospital_id
     WHERE p.id = $1`,
    [pid],
  );
  if (pr.rows.length === 0) {
    return { ok: false, status: 404, error: "Patient not found" };
  }
  const row = pr.rows[0];

  if (isSuperAdmin(req)) {
    return { ok: true, row };
  }

  const hid = hospitalId(req);
  if (hid != null && Number(row.hospital_id) === hid) {
    return { ok: true, row };
  }

  const sh = await client.query(
    `SELECT id, status FROM patient_shares
     WHERE patient_id = $1 AND to_hospital_id = $2 AND status = 'accepted'`,
    [pid, hid],
  );
  if (hid != null && sh.rows.length > 0) {
    return { ok: true, row };
  }

  return { ok: false, status: 403, error: "Not allowed to view this patient" };
}

async function canEditPatient(client, req, patientId) {
  const access = await canViewPatient(client, req, patientId);
  if (!access.ok) return access;
  if (isSuperAdmin(req)) {
    return { ok: false, status: 403, error: "Use a hospital account to edit patient records" };
  }
  const hid = hospitalId(req);
  if (hid == null || Number(access.row.hospital_id) !== hid) {
    return { ok: false, status: 403, error: "Only the owning hospital can edit this record" };
  }
  return { ok: true, row: access.row };
}

const listPatients = async (req, res) => {
  const scope = (req.query.scope || "owned").toLowerCase();
  try {
    if (isSuperAdmin(req)) {
      const result = await pool.query(
        `SELECT p.*, h.name AS owning_hospital_name
         FROM patients p
         JOIN hospitals h ON h.id = p.hospital_id
         ORDER BY p.updated_at DESC, p.id DESC`,
      );
      return res.json(result.rows);
    }

    const hid = hospitalId(req);
    if (hid == null) {
      return res.status(403).json({ error: "No hospital affiliation" });
    }

    if (scope === "shared") {
      const result = await pool.query(
        `SELECT p.*, h.name AS owning_hospital_name, ps.id AS share_id, ps.created_at AS shared_at
         FROM patient_shares ps
         JOIN patients p ON p.id = ps.patient_id
         JOIN hospitals h ON h.id = p.hospital_id
         WHERE ps.to_hospital_id = $1 AND ps.status = 'accepted'
         ORDER BY ps.created_at DESC`,
        [hid],
      );
      return res.json(result.rows);
    }

    const result = await pool.query(
      `SELECT p.*, h.name AS owning_hospital_name
       FROM patients p
       JOIN hospitals h ON h.id = p.hospital_id
       WHERE p.hospital_id = $1
       ORDER BY p.updated_at DESC, p.id DESC`,
      [hid],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listIncomingShares = async (req, res) => {
  if (isSuperAdmin(req)) {
    return res.json([]);
  }
  const hid = hospitalId(req);
  if (hid == null) {
    return res.status(403).json({ error: "No hospital affiliation" });
  }
  try {
    const result = await pool.query(
      `SELECT ps.*,
              p.first_name, p.last_name, p.date_of_birth, p.external_reference,
              fh.name AS from_hospital_name
       FROM patient_shares ps
       JOIN patients p ON p.id = ps.patient_id
       JOIN hospitals fh ON fh.id = ps.from_hospital_id
       WHERE ps.to_hospital_id = $1 AND ps.status = 'pending'
       ORDER BY ps.created_at DESC`,
      [hid],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPatient = async (req, res) => {
  const { id } = req.params;
  try {
    const access = await canViewPatient(pool, req, id);
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error });
    }
    let outbound = [];
    if (!isSuperAdmin(req) && hospitalId(req) === Number(access.row.hospital_id)) {
      const sh = await pool.query(
        `SELECT ps.*, th.name AS to_hospital_name
         FROM patient_shares ps
         JOIN hospitals th ON th.id = ps.to_hospital_id
         WHERE ps.patient_id = $1
         ORDER BY ps.created_at DESC`,
        [id],
      );
      outbound = sh.rows;
    }
    res.json({ patient: access.row, outbound_shares: outbound });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createPatient = async (req, res) => {
  if (!isHospitalStaff(req)) {
    return res.status(403).json({ error: "Only hospital staff can create patient records" });
  }
  const hid = hospitalId(req);
  const {
    first_name,
    last_name,
    date_of_birth,
    gender,
    phone,
    external_reference,
    clinical_summary,
  } = req.body;

  if (!first_name?.trim() || !last_name?.trim()) {
    return res.status(400).json({ error: "First name and last name are required" });
  }

  try {
    const ins = await pool.query(
      `INSERT INTO patients (
        hospital_id, created_by_user_id, external_reference,
        first_name, last_name, date_of_birth, gender, phone, clinical_summary
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        hid,
        req.user.id,
        external_reference?.trim() || null,
        first_name.trim(),
        last_name.trim(),
        date_of_birth || null,
        gender?.trim() || null,
        phone?.trim() || null,
        clinical_summary?.trim() || null,
      ],
    );
    const row = ins.rows[0];
    const h = await pool.query("SELECT name FROM hospitals WHERE id = $1", [hid]);
    res.status(201).json({
      ...row,
      owning_hospital_name: h.rows[0]?.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updatePatient = async (req, res) => {
  if (!isHospitalStaff(req)) {
    return res.status(403).json({ error: "Only hospital staff can update patient records" });
  }
  const { id } = req.params;
  const access = await canEditPatient(pool, req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const b = req.body;
  const assignments = [];
  const values = [];
  let n = 1;

  const setField = (col, val) => {
    assignments.push(`${col} = $${n}`);
    values.push(val);
    n += 1;
  };

  if (Object.prototype.hasOwnProperty.call(b, "first_name")) {
    setField("first_name", String(b.first_name || "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(b, "last_name")) {
    setField("last_name", String(b.last_name || "").trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(b, "date_of_birth")) {
    setField("date_of_birth", b.date_of_birth || null);
  }
  if (Object.prototype.hasOwnProperty.call(b, "gender")) {
    setField("gender", b.gender?.trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(b, "phone")) {
    setField("phone", b.phone?.trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(b, "external_reference")) {
    setField("external_reference", b.external_reference?.trim() || null);
  }
  if (Object.prototype.hasOwnProperty.call(b, "clinical_summary")) {
    setField("clinical_summary", b.clinical_summary?.trim() || null);
  }

  if (assignments.length === 0) {
    return res.json(access.row);
  }
  assignments.push("updated_at = NOW()");
  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE patients SET ${assignments.join(", ")} WHERE id = $${n} RETURNING *`,
      values,
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sharePatient = async (req, res) => {
  if (!isHospitalStaff(req)) {
    return res.status(403).json({ error: "Only hospital staff can share patient records" });
  }
  const { id } = req.params;
  const { to_hospital_id, sender_notes } = req.body;
  const toId = Number(to_hospital_id);
  if (!toId || Number.isNaN(toId)) {
    return res.status(400).json({ error: "to_hospital_id is required" });
  }

  const access = await canEditPatient(pool, req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }

  const hid = hospitalId(req);
  if (toId === hid) {
    return res.status(400).json({ error: "Cannot share to the same hospital" });
  }

  try {
    const target = await pool.query(
      "SELECT id, name, registration_status FROM hospitals WHERE id = $1",
      [toId],
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ error: "Target hospital not found" });
    }
    if (target.rows[0].registration_status !== "approved") {
      return res.status(400).json({ error: "Target hospital is not approved for collaboration" });
    }

    const dup = await pool.query(
      `SELECT id FROM patient_shares
       WHERE patient_id = $1 AND to_hospital_id = $2 AND status = 'pending'`,
      [id, toId],
    );
    if (dup.rows.length > 0) {
      return res.status(409).json({ error: "A pending share to this hospital already exists" });
    }

    const ins = await pool.query(
      `INSERT INTO patient_shares (
        patient_id, from_hospital_id, to_hospital_id, status, sender_notes, created_by_user_id
      ) VALUES ($1, $2, $3, 'pending', $4, $5)
      RETURNING *`,
      [id, hid, toId, sender_notes?.trim() || null, req.user.id],
    );
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const respondShare = async (req, res) => {
  if (isSuperAdmin(req)) {
    return res.status(403).json({ error: "Not applicable for platform admin" });
  }
  const hid = hospitalId(req);
  if (hid == null) {
    return res.status(403).json({ error: "No hospital affiliation" });
  }

  const shareId = req.params.shareId;
  const { action, response_notes } = req.body;
  if (action !== "accept" && action !== "decline") {
    return res.status(400).json({ error: "action must be accept or decline" });
  }

  try {
    const sh = await pool.query(
      `SELECT * FROM patient_shares WHERE id = $1 AND to_hospital_id = $2`,
      [shareId, hid],
    );
    if (sh.rows.length === 0) {
      return res.status(404).json({ error: "Share not found" });
    }
    if (sh.rows[0].status !== "pending") {
      return res.status(400).json({ error: "This share is no longer pending" });
    }

    const status = action === "accept" ? "accepted" : "declined";
    const upd = await pool.query(
      `UPDATE patient_shares
       SET status = $1, response_notes = $2, responded_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [status, response_notes?.trim() || null, shareId],
    );
    res.json(upd.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const attachFile = async (req, res) => {
  if (!isHospitalStaff(req)) {
    return res.status(403).json({ error: "Only hospital staff can upload attachments" });
  }
  const { id } = req.params;
  const access = await canEditPatient(pool, req, id);
  if (!access.ok) {
    return res.status(access.status).json({ error: access.error });
  }
  if (!req.file) {
    return res.status(400).json({ error: "File is required" });
  }
  const rel = `/uploads/${req.file.filename}`;
  try {
    const result = await pool.query(
      "UPDATE patients SET attachment_path = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
      [rel, id],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  listPatients,
  listIncomingShares,
  getPatient,
  createPatient,
  updatePatient,
  sharePatient,
  respondShare,
  attachFile,
};
