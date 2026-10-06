import authApi from "./api";
import { createNotificationClient } from "./notificationClient";

export const notificationClient = createNotificationClient(authApi);
