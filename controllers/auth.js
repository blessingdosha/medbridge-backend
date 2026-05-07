const pool = require("../db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function buildUserResponse(row) {
  return {
    id: row.id,
    name: row.name,
    first_name: row.first_name || null,
    last_name: row.last_name || null,
    email: row.email,
    role: row.role,
    hospital_id: row.hospital_id ?? null,
    hospital_name: row.hospital_name ?? null,
    hospital_license_number: row.hospital_license_number ?? null,
    must_change_password: Boolean(row.must_change_password),
  };
}

// Register a hospital + founding doctor (pending platform approval).
const registerOrganization = async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    password,
    hospital,
  } = req.body;

  if (!first_name?.trim() || !last_name?.trim() || !email?.trim() || !password) {
    return res.status(400).json({ error: "First name, last name, email, and password are required" });
  }
  if (!hospital || typeof hospital !== "object") {
    return res.status(400).json({ error: "Hospital details are required" });
  }

  const {
    name: hName,
    location,
    city,
    state,
    contact_email,
    contact_phone,
    license_number,
    latitude,
    longitude,
  } = hospital;

  if (!hName?.trim() || !license_number?.trim()) {
    return res.status(400).json({ error: "Hospital name and license number are required" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dupLicense = await client.query(
      "SELECT id FROM hospitals WHERE license_number = $1",
      [license_number.trim()],
    );
    if (dupLicense.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "A hospital with this license number is already registered" });
    }

    const dupEmail = await client.query("SELECT id FROM users WHERE email = $1", [
      email.trim().toLowerCase(),
    ]);
    if (dupEmail.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const hospIns = await client.query(
      `INSERT INTO hospitals (
        name, location, contact_email, contact_phone, facility_type,
        latitude, longitude, license_number, registration_status, city, state
      ) VALUES ($1, $2, $3, $4, 'hospital', $5, $6, $7, 'pending', $8, $9)
      RETURNING id, name`,
      [
        hName.trim(),
        location?.trim() ||
          [city?.trim(), state?.trim()].filter(Boolean).join(", ") ||
          null,
        contact_email?.trim() || null,
        contact_phone?.trim() || null,
        latitude ?? null,
        longitude ?? null,
        license_number.trim(),
        city?.trim() || null,
        state?.trim() || null,
      ],
    );
    const hospitalId = hospIns.rows[0].id;

    const displayName = `${first_name.trim()} ${last_name.trim()}`;
    const hashedPassword = await bcrypt.hash(password, 10);

    await client.query(
      `INSERT INTO users (
        name, first_name, last_name, email, password, role, hospital_id, must_change_password
      ) VALUES ($1, $2, $3, $4, $5, 'hospital_admin', $6, false)`,
      [
        displayName,
        first_name.trim(),
        last_name.trim(),
        email.trim().toLowerCase(),
        hashedPassword,
        hospitalId,
      ],
    );
    await client.query(
      `INSERT INTO facilities (
        name, address, contact_email, contact_phone, facility_type, latitude, longitude, services, hospital_id
      ) VALUES ($1, $2, $3, $4, 'hospital', $5, $6, ARRAY[]::text[], $7)`,
      [
        hName.trim(),
        location?.trim() ||
          [city?.trim(), state?.trim()].filter(Boolean).join(", ") ||
          null,
        contact_email?.trim() || email.trim().toLowerCase(),
        contact_phone?.trim() || null,
        latitude ?? null,
        longitude ?? null,
        hospitalId,
      ],
    );

    await client.query("COMMIT");
    res.status(201).json({
      message:
        "Registration submitted. Your hospital will appear as pending until a platform administrator approves it. You will be able to sign in after approval.",
      hospital_id: hospitalId,
      hospital_name: hospIns.rows[0].name,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") {
      return res.status(409).json({ error: "Duplicate email or license number" });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT u.*, h.name AS hospital_name, h.license_number AS hospital_license_number,
              h.registration_status AS hospital_registration_status
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email?.trim() || ""],
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.role !== "super_admin" && user.hospital_id) {
      const status = user.hospital_registration_status;
      if (status === "pending") {
        return res.status(403).json({
          error: "Your hospital is still pending approval. You will be notified by email when you can sign in.",
          code: "HOSPITAL_PENDING",
        });
      }
      if (status === "rejected") {
        return res.status(403).json({
          error: "This hospital registration was not approved.",
          code: "HOSPITAL_REJECTED",
        });
      }
    }

    const token = signToken({
      id: user.id,
      role: user.role,
      hospitalId: user.hospital_id,
      must_change_password: Boolean(user.must_change_password),
    });

    const { password: _pw, hospital_registration_status: _hs, ...safe } = user;
    res.json({
      message: "Login successful",
      token,
      user: buildUserResponse(safe),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!current_password || !new_password || new_password.length < 8) {
    return res.status(400).json({
      error: "Current password and a new password (at least 8 characters) are required",
    });
  }

  try {
    const result = await pool.query("SELECT id, password FROM users WHERE id = $1", [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const row = result.rows[0];
    const ok = await bcrypt.compare(current_password, row.password);
    if (!ok) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }
    const hashed = await bcrypt.hash(new_password, 10);
    await pool.query(
      "UPDATE users SET password = $1, must_change_password = false WHERE id = $2",
      [hashed, userId],
    );
    const u = await pool.query(
      `SELECT u.*, h.name AS hospital_name, h.license_number AS hospital_license_number
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = $1`,
      [userId],
    );
    const fresh = u.rows[0];
    const { password: _p, ...safe } = fresh;
    const token = signToken({
      id: fresh.id,
      role: fresh.role,
      hospitalId: fresh.hospital_id,
      must_change_password: false,
    });
    res.json({
      message: "Password updated",
      token,
      user: buildUserResponse(safe),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const me = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.*, h.name AS hospital_name, h.registration_status AS hospital_registration_status, h.license_number AS hospital_license_number
       FROM users u
       LEFT JOIN hospitals h ON u.hospital_id = h.id
       WHERE u.id = $1`,
      [req.user.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const row = result.rows[0];
    const { password: _p, ...safe } = row;
    res.json({ user: buildUserResponse(safe) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  registerOrganization,
  login,
  changePassword,
  me,
};
