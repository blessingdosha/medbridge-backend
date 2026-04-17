const express = require("express");
const { getRecommendations } = require("../controllers/recommendations");

const router = express.Router();

router.get("/", getRecommendations);

module.exports = router;
