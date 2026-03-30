const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors({
  origin: "http://localhost:8080",
  credentials: true
}));
app.use(express.json());

const path = require('path');

app.use(express.static(path.join(__dirname, '../frontend')));

// Import routes
const hospitalRoutes = require("./routes/hospitals");
const laboratoryRoutes = require("./routes/laboratories");
const equipmentRoutes = require("./routes/equipment");
const requestRoutes = require("./routes/requests");
const authRoutes = require("./routes/auth");

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/hospitals", hospitalRoutes);
app.use("/api/laboratory", laboratoryRoutes);
app.use("/api/equipment", equipmentRoutes);
app.use("/api/requests", requestRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("MedBridge Backend Running...");
});

// Start server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});

app.post("/api/auth/login", (req, res) => {

  console.log("Login request received:", req.body);
  
  const { email, password } = req.body;
  
  if(email === "admin@test.com" && password === "1234"){
  
  res.json({
  token: "my-secret-token"
  });
  
  }else{
  
  res.status(401).json({
  message: "Invalid credentials"
  });
  
  }
  
  });

