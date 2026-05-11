const express = require("express");
const {
  listPatients,
  listIncomingShares,
  getPatient,
  createPatient,
  updatePatient,
  sharePatient,
  respondShare,
  attachFile,
} = require("../controllers/patients");
const { authenticate } = require("../middleware/auth");
const upload = require("../middleware/upload");

const router = express.Router();

router.use(authenticate);

router.get("/incoming", listIncomingShares);
router.patch("/shares/:shareId/respond", respondShare);

router.get("/", listPatients);
router.post("/", createPatient);
router.post("/:id/attachment", upload.single("file"), attachFile);
router.get("/:id", getPatient);
router.patch("/:id", updatePatient);
router.post("/:id/share", sharePatient);

module.exports = router;
