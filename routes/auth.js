const express = require("express");
const {
  registerOrganization,
  login,
  changePassword,
  me,
} = require("../controllers/auth");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/register-organization", registerOrganization);
router.post("/login", login);
router.post("/change-password", authenticate, changePassword);
router.get("/me", authenticate, me);

module.exports = router;
