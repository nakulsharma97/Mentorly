import { useCallback, useState } from "react";

/**
 * Builds a stable dedupe key for a toast. Identical error toasts (same type,
 * title and message) raised while one is still on screen are collapsed into a
 * single toast instead of stacking — this prevents "toast spam" when the same
 * failed request fires repeatedly (e.g. a failing poll or a reload loop).
 */
function toastKey(toast) {
  return `${toast?.type || "info"}|${toast?.title || ""}|${toast?.message || ""}`;
}

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
    // Only identical ERROR toasts are collapsed. Success/info toasts keep their
    // own stack so a repeated successful action (e.g. two reports moved to the
    // same status) still shows feedback for each one.
    const key = normalizedToast.type === "error" ? toastKey(normalizedToast) : null;
    if (!key) {
      setToasts((prev) => [...prev, normalizedToast]);
      return;
    }

    setToasts((prev) => {
      const existingIndex = prev.findIndex(
        (item) => item.id !== id && toastKey(item) === key
      );
      if (existingIndex >= 0) {
        // A toast with the same content is already visible. Replace it with the
        // new toast (fresh id so the dismiss timer restarts) instead of adding
        // a duplicate beneath it.
        const next = [...prev];
        next[existingIndex] = normalizedToast;
        return next;
      }
      return [...prev, normalizedToast];
    });
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { toasts, notify, dismissToast };
}
