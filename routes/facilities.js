const express = require("express");
const { addFacility, getFacilities } = require("../controllers/facilities");

const router = express.Router();

router.post("/", addFacility);
router.get("/", getFacilities);

module.exports = router;
