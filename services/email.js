const nodemailer = require("nodemailer");

function getTransport() {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function appUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:8080").replace(/\/$/, "");
}

async function sendMail({ to, subject, text, html }) {
  const transport = getTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "MedBridge <noreply@medbridge.local>";

  if (!transport) {
    console.warn(
      "[email] SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS). Message not sent. Body:\n",
      { to, subject, text: text?.slice(0, 200) },
    );
    return { sent: false, reason: "smtp_not_configured" };
  }

  await transport.sendMail({ from, to, subject, text, html });
  return { sent: true };
}

async function sendDoctorInviteEmail({
  to,
  firstName,
  temporaryPassword,
}) {
  const loginUrl = `${appUrl()}/auth`;
  const subject = "Your MedBridge account";
  const text = [
    `Hello ${firstName},`,
    "",
    "An administrator has created a MedBridge account for you.",
    `Email (login): ${to}`,
    `Temporary password: ${temporaryPassword}`,
    "",
    `Sign in: ${loginUrl}`,
    "",
    "You will be asked to change your password after signing in.",
    "",
    "— MedBridge",
  ].join("\n");

  const html = `
    <p>Hello ${escapeHtml(firstName)},</p>
    <p>An administrator has created a <strong>MedBridge</strong> account for you.</p>
    <ul>
      <li><strong>Email:</strong> ${escapeHtml(to)}</li>
      <li><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</li>
    </ul>
    <p><a href="${loginUrl}">Sign in to MedBridge</a></p>
    <p>You will be prompted to change your password after your first login.</p>
  `;

  return sendMail({ to, subject, text, html });
}

async function sendHospitalApprovedEmail({ to, hospitalName }) {
  const loginUrl = `${appUrl()}/auth`;
  const subject = `Hospital approved: ${hospitalName}`;
  const text = [
    `Your hospital "${hospitalName}" has been approved on MedBridge.`,
    "",
    `You may sign in: ${loginUrl}`,
    "",
    "— MedBridge",
  ].join("\n");
  const html = `<p>Your hospital <strong>${escapeHtml(hospitalName)}</strong> has been approved.</p><p><a href="${loginUrl}">Sign in</a></p>`;
  return sendMail({ to, subject, text, html });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  sendDoctorInviteEmail,
  sendHospitalApprovedEmail,
  sendMail,
};
