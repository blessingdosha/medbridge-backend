const pool = require("../db");
const { sendHospitalApprovedEmail } = require("../services/email");

const overview = async (req, res) => {
  try {
    const [users, hospitals, labs, facilities, equipment, pendingH] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS c FROM users"),
      pool.query("SELECT COUNT(*)::int AS c FROM hospitals"),
      pool.query("SELECT COUNT(*)::int AS c FROM laboratories"),
      pool.query("SELECT COUNT(*)::int AS c FROM facilities"),
      pool.query("SELECT COUNT(*)::int AS c FROM equipment"),
      pool.query(
        "SELECT COUNT(*)::int AS c FROM hospitals WHERE registration_status = 'pending'",
      ),
    ]);
    res.json({
      users: users.rows[0].c,
      hospitals: hospitals.rows[0].c,
      laboratories: labs.rows[0].c,
      facilities: facilities.rows[0].c,
      equipment: equipment.rows[0].c,
      pending_hospitals: pendingH.rows[0].c,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listHospitals = async (req, res) => {
  const { status } = req.query;
  try {
    let sql = `SELECT h.*, 
      (SELECT COUNT(*)::int FROM users u WHERE u.hospital_id = h.id) AS user_count
      FROM hospitals h`;
    const params = [];
    if (status === "pending" || status === "approved" || status === "rejected") {
      sql += " WHERE h.registration_status = $1";
      params.push(status);
    }
    sql += " ORDER BY h.created_at DESC NULLS LAST, h.id DESC";
    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const approveHospital = async (req, res) => {
  const { id } = req.params;
  try {
    const upd = await pool.query(
      `UPDATE hospitals
       SET registration_status = 'approved', rejected_reason = NULL, approved_at = NOW()
       WHERE id = $1 AND registration_status = 'pending'
       RETURNING *`,
      [id],
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: "Pending hospital not found" });
    }
    const hospital = upd.rows[0];
    const adminRow = await pool.query(
      "SELECT email FROM users WHERE hospital_id = $1 AND role = 'hospital_admin' ORDER BY id LIMIT 1",
      [id],
    );
    const adminEmail = adminRow.rows[0]?.email;
    if (adminEmail) {
      // Email is best-effort: approval should not fail if SMTP is slow/down.
      void sendHospitalApprovedEmail({
        to: adminEmail,
        hospitalName: hospital.name,
      }).catch((emailErr) => {
        console.warn(
          `[admin.approveHospital] approval email failed for hospital ${hospital.id}:`,
          emailErr?.message || emailErr,
        );
      });
    }
    res.json({
      message: `Hospital ${hospital.name} approved successfully.`,
      hospital,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const rejectHospital = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    const upd = await pool.query(
      `UPDATE hospitals
       SET registration_status = 'rejected', rejected_reason = $2, approved_at = NULL
       WHERE id = $1 AND registration_status = 'pending'
       RETURNING *`,
      [id, reason?.trim() || null],
    );
    if (upd.rows.length === 0) {
      return res.status(404).json({ error: "Pending hospital not found" });
    }
    const hospital = upd.rows[0];
    res.json({
      message: `Hospital ${hospital.name} was rejected.`,
      hospital,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const listUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.first_name, u.last_name, u.email, u.role, u.hospital_id, u.must_change_password, u.created_at,
              h.name AS hospital_name, h.registration_status AS hospital_status
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       ORDER BY u.id`,
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  overview,
  listHospitals,
  approveHospital,
  rejectHospital,
  listUsers,
};
