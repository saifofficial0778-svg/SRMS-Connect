import { useContext, useSyncExternalStore } from "react";
import { NotificationsContext } from "../context/notificationsContext";

// { ...state, actions } - state re-renders the caller whenever the store changes
export default function useNotifications() {
  const store = useContext(NotificationsContext);
  if (!store) {
    throw new Error("useNotifications must be used inside <NotificationsProvider>");
  }
  const state = useSyncExternalStore(store.subscribe, store.getState);
  return { ...state, actions: store };
}
