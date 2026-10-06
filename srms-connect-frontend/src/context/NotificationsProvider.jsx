import { useEffect, useState } from "react";
import { NotificationsContext } from "./notificationsContext";
import { createNotificationStore } from "../services/notificationStore";
import { notificationClient } from "../services/notificationService";
import { connectSocket } from "../services/socket";

// Mounted once inside the signed-in layout: loads notifications and keeps them live over the
// same Socket.IO connection the chat uses (the socket itself is shared, see services/socket.js).
export default function NotificationsProvider({ children }) {
  const [store] = useState(() => createNotificationStore(notificationClient));

  useEffect(() => {
    store.load();

    const socket = connectSocket();
    if (!socket) return undefined;

    const onNotification = (payload) => store.receive(payload);
    const onReadSync = (payload) => store.applyReadSync(payload);
    // anything created while the connection was down is picked up on reconnect
    const onReconnect = () => store.load({ silent: true });

    socket.on("notification", onNotification);
    socket.on("notifications_read", onReadSync);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("notification", onNotification);
      socket.off("notifications_read", onReadSync);
      socket.io.off("reconnect", onReconnect);
      // the socket stays open: chat shares it, and logout closes it
    };
  }, [store]);

  return <NotificationsContext.Provider value={store}>{children}</NotificationsContext.Provider>;
}
