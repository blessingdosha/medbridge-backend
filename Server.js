const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

// CORS middleware (updated)
app.use(
  cors({
    origin: "http://localhost:8080",
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

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/laboratory", laboratoryRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/facilities", facilitiesRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("MedBridge Backend Running...");
});

// Start server
app.listen(7777, () => {
  console.log("Server running on port 7777");
});
