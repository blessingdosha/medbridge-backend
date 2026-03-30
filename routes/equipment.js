const express = require("express");
const { addEquipment, getAvailableEquipment } = require("../controllers/equipment");

const router = express.Router();

router.post("/", addEquipment);
router.get("/available", getAvailableEquipment);

module.exports = router;