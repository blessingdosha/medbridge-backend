const express = require("express");
const { addHospital, getAllFacilities, getFacilitiesByType, getNearbyFacilities } = require("../controllers/hospitals");

const router = express.Router();

router.post("/", addHospital);
router.get("/", getAllFacilities);
router.get("/by-type", getFacilitiesByType);
router.get("/nearby", getNearbyFacilities);

module.exports = router;