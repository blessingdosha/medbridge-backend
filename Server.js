const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:8080")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// CORS middleware (updated)
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use((req, res, next) => {
  console.log("Incoming request:", req.method, req.url);
  next();
});

app.use(express.json());
// app.options("*", cors());
app.use(express.static(path.join(__dirname, "../frontend")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.get("/", (req, res) => {
  console.log("Headers:", req.headers);
  res.send("Test route working");
});
// Import routes
const hospitalRoutes = require("./routes/hospitals");
const laboratoryRoutes = require("./routes/laboratories");
const equipmentRoutes = require("./routes/equipment");
const requestRoutes = require("./routes/requests");
const authRoutes = require("./routes/auth");
const facilitiesRoutes = require("./routes/facilities");
const recommendationsRoutes = require("./routes/recommendations");
const adminRoutes = require("./routes/admin");
const hospitalTeamRoutes = require("./routes/hospitalTeam");
const patientRoutes = require("./routes/patients");

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/laboratory", laboratoryRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/facilities", facilitiesRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/hospital/team", hospitalTeamRoutes);
app.use("/api/patients", patientRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("MedBridge Backend Running...");
});

// Start server
app.listen(7777, () => {
  console.log("Server running on port 7777");
});
