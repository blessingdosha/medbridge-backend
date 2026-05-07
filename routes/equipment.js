const express = require("express");
const { addEquipment, getAvailableEquipment } = require("../controllers/equipment");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, addEquipment);
router.get("/available", authenticate, getAvailableEquipment);

module.exports = router;