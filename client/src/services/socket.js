import { io } from "socket.io-client";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const socket = io(API_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
});

export function connectSocket() {
  const token = localStorage.getItem("token");

  if (!token) {
    return false;
  }

  socket.auth = {
    token,
  };

  if (!socket.connected) {
    socket.connect();
  }

  return true;
}

export function disconnectSocket() {
  if (socket.connected) {
    socket.disconnect();
  }
}

export default socket;