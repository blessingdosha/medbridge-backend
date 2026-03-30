const express = require("express");
const { addLaboratory, getAllLaboratories } = require("../controllers/laboratories");

const router = express.Router();

router.post("/", addLaboratory);
router.get("/", getAllLaboratories);

module.exports = router;