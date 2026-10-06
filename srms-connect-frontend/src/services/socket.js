import { io } from "socket.io-client";
import { endSession } from "./authInterceptor";

// ASSUMPTION: your Socket.IO server is attached to the same host as your
// REST API but WITHOUT the "/api" prefix (sockets normally aren't mounted
// under a REST path). If your server runs elsewhere, set VITE_SOCKET_URL
// in your .env file to override this.
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

let socket = null;

export function connectSocket() {
  const token = localStorage.getItem("token");
  if (!token) return null;

  // one shared connection for the whole signed-in app (notifications + chat). Reuse it even while
  // it is still connecting, otherwise a second page mounting would open a duplicate socket.
  if (socket) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket"],
  });

  // The server rejects the handshake ("Invalid token") or pushes "auth_error" when the
  // session was revoked/expired/blocked - same outcome as a 401 over HTTP.
  const sessionEnded = () =>
    endSession({
      storage: localStorage,
      onClear: disconnectSocket,
      redirect: (path) => window.location.assign(path),
      pathname: window.location.pathname,
    });
  socket.on("auth_error", sessionEnded);
  socket.on("connect_error", (err) => {
    if (err?.message === "Invalid token") sessionEnded();
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
