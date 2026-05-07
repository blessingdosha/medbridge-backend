const express = require("express");
const { listTeam, inviteDoctor } = require("../controllers/hospitalTeam");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireRole("hospital_admin"));

router.get("/", listTeam);
router.post("/invite", inviteDoctor);

module.exports = router;
