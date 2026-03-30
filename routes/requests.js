const express = require("express");
const { requestEquipment, getAllRequests, updateRequestStatus } = require("../controllers/requests");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

// Create request (protected)
router.post("/", authenticate, requestEquipment);

// Get all requests (protected)
router.get("/", authenticate, getAllRequests);

// Update request status (protected)
router.patch("/:id", authenticate, updateRequestStatus);

module.exports = router;