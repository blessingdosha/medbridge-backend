const pool = require("../db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { sendDoctorInviteEmail } = require("../services/email");

function randomPassword(length = 14) {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[bytes[i] % chars.length];
  }
  return out;
}

const listTeam = async (req, res) => {
  const hospitalId = req.user.hospitalId;
  if (!hospitalId) {
    return res.status(400).json({ error: "No hospital context" });
  }
  try {
    const result = await pool.query(
      `SELECT id, name, first_name, last_name, email, role, must_change_password, created_at
       FROM users
       WHERE hospital_id = $1
       ORDER BY id`,
      [hospitalId],
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const inviteDoctor = async (req, res) => {
  const hospitalId = req.user.hospitalId;
  if (!hospitalId) {
    return res.status(400).json({ error: "No hospital context" });
  }

  const { first_name, last_name, email } = req.body;
  if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
    return res.status(400).json({ error: "First name, last name, and email are required" });
  }

  const emailNorm = email.trim().toLowerCase();
  const displayName = `${first_name.trim()} ${last_name.trim()}`;
  const plainPassword = randomPassword(14);

  try {
    const statusCheck = await pool.query(
      "SELECT registration_status FROM hospitals WHERE id = $1",
      [hospitalId],
    );
    if (statusCheck.rows.length === 0) {
      return res.status(400).json({ error: "Hospital not found" });
    }
    if (statusCheck.rows[0].registration_status !== "approved") {
      return res.status(403).json({ error: "Hospital must be approved before inviting staff" });
    }

    const hashed = await bcrypt.hash(plainPassword, 10);
    const ins = await pool.query(
      `INSERT INTO users (
        name, first_name, last_name, email, password, role, hospital_id, must_change_password, invited_by
      ) VALUES ($1, $2, $3, $4, $5, 'physician', $6, true, $7)
      RETURNING id, name, first_name, last_name, email, role, must_change_password, created_at`,
      [
        displayName,
        first_name.trim(),
        last_name.trim(),
        emailNorm,
        hashed,
        hospitalId,
        req.user.id,
      ],
    );

    await sendDoctorInviteEmail({
      to: emailNorm,
      firstName: first_name.trim(),
      temporaryPassword: plainPassword,
    });

    res.status(201).json({
      message: "Invitation sent. The doctor will receive an email with a temporary password.",
      user: ins.rows[0],
    });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A user with this email already exists" });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listTeam, inviteDoctor };
