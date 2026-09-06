require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const registerRoomHandlers = require("./socket/roomHandlers");
const authRoutes = require("./routes/authRoutes");
const socketAuthMiddleware = require("./socket/authMiddleware");
const pool = require("./db/pool");

// Initialize Express app
const app = express();

// Create underlying HTTP server
const server = http.createServer(app);

// Frontend URL
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

// Express middleware
app.use(
  cors({
    origin: CLIENT_URL,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);

app.use(express.json());

// Attach Socket.io server
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
  },
});

// REST API routes
app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "YouTube Watch Party is running",
  });
});

// Health check
app.get("/health", (req, res) => {
  return res.status(200).json({
    success: true,
    message: "Server is healthy",
  });
});

app.use("/api/auth", authRoutes);

// Database connection test
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    return res.status(200).json({
      success: true,
      message: "Database connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection error:", error);

    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

// Socket.io authentication middleware
io.use(socketAuthMiddleware);

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log("Authenticated socket:", socket.id);
  console.log("User ID:", socket.data.userId);

  registerRoomHandlers(io, socket);

  socket.on("disconnect", (reason) => {
    console.log(`Socket disconnected: ${socket.id} (${reason})`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});