import { useCallback, useRef, useState } from "react";

/**
 * Minimal in-page toast queue. No provider/context needed —
 * import this inside any page that wants toasts and render
 * <ToastStack toasts={toasts} /> from components/ui/Toast.jsx.
 */
export default function useToast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = "success", duration = 3200) => {
      const id = ++idRef.current;
      setToasts((current) => [...current, { id, message, type }]);
      window.setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return { toasts, showToast, dismiss };
}
