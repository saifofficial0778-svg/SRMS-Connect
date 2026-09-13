import { io } from "socket.io-client";

// ASSUMPTION: your Socket.IO server is attached to the same host as your
// REST API but WITHOUT the "/api" prefix (sockets normally aren't mounted
// under a REST path). If your server runs elsewhere, set VITE_SOCKET_URL
// in your .env file to override this.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  if (socket && socket.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
  });

  return socket;
}

export function getSocket() {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
