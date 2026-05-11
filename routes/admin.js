const express = require("express");
const {
  overview,
  listHospitals,
  approveHospital,
  rejectHospital,
  listUsers,
} = require("../controllers/admin");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

router.use(authenticate, requireRole("super_admin"));

router.get("/overview", overview);
router.get("/hospitals", listHospitals);
router.patch("/hospitals/:id/approve", approveHospital);
router.patch("/hospitals/:id/reject", rejectHospital);
router.get("/users", listUsers);

module.exports = router;
