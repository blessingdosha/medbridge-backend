const express = require("express");
const {
  addHospital,
  getAllHospitals,
  getHospitalById,
  getNearbyHospitals,
} = require("../controllers/hospitals");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, addHospital);
router.get("/", authenticate, getAllHospitals);
router.get("/nearby", authenticate, getNearbyHospitals);
router.get("/:id", authenticate, getHospitalById);

module.exports = router;