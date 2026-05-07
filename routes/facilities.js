const express = require("express");
const { getFacilities } = require("../controllers/facilities");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", authenticate, requireRole("super_admin"), getFacilities);

module.exports = router;
