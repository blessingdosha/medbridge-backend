const express = require("express");
const {
  requestEquipment,
  getRequestById,
  getAllRequests,
  updateRequestStatus,
  schedulePatientVisit,
  downloadRequestReport,
  sendRequestResult,
  getRequestResult,
} = require("../controllers/requests");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

// Create request (protected)
router.post("/", authenticate, requestEquipment);

// Get all requests (scoped by hospital for non–super-admins)
router.get("/", authenticate, getAllRequests);

// Schedule patient visit (receiving hospital / admin)
router.patch("/:id/patient-visit", authenticate, schedulePatientVisit);

// Download combined visit + report summary (.txt)
router.get("/:id/report", authenticate, downloadRequestReport);

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
