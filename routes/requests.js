const express = require("express");
const {
  requestEquipment,
  getAllRequests,
  updateRequestStatus,
  sendRequestResult,
  getRequestResult,
} = require("../controllers/requests");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Create request (protected)
router.post("/", authenticate, requestEquipment);

// Get all requests (protected)
router.get("/", getAllRequests);

// Update request status (protected)
router.patch("/:id", authenticate, updateRequestStatus);

// Send result for an approved request (protected)
router.post(
  "/:id/results",
  authenticate,
  upload.single("attachment"),
  sendRequestResult,
);

// Get result for a request (protected)
router.get("/:id/results", authenticate, getRequestResult);

module.exports = router;
