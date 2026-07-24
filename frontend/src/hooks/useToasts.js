import { useCallback, useState } from "react";

export function useToasts() {
  const [toasts, setToasts] = useState([]);

  const notify = useCallback((toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const normalizedToast = {
      id,
      duration: toast?.persistent ? 12000 : 4200,
      persistent: false,
      ...toast,
    };
    setToasts((prev) => [...prev, normalizedToast]);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { toasts, notify, dismissToast };
}
