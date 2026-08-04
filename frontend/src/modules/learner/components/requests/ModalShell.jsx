import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

/**
 * ModalShell — shared accessible modal frame for the My Requests surface.
 * Handles: Escape-to-close, backdrop click, initial focus on the close
 * button, and a Tab focus trap. All request modals (details / payment /
 * reply) render through this shell so behavior stays consistent.
 */
export default function ModalShell({
  title,
  subtitle,
  label,
  closeLabel = "Close",
  onClose,
  busy = false,
  children,
  footer,
}) {
  const dialogRef = useRef(null);
  const closeRef = useRef(null);

  // Escape closes (unless a busy async action is running)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !busy) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  // Move focus into the dialog when it opens
  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current?.focus(), 60);
    return () => window.clearTimeout(t);
  }, []);

  // Simple Tab focus trap
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const onTab = (e) => {
      if (e.key !== "Tab") return;
      const focusables = dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener("keydown", onTab);
    return () => dialog.removeEventListener("keydown", onTab);
  }, []);

  return (
    <motion.div
      className="lqr-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose?.();
      }}
      role="presentation"
    >
      <motion.div
        ref={dialogRef}
        className="lqr-modal"
        role="dialog"
        aria-modal="true"
        aria-label={label || title}
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="lqr-modal__head">
          <div>
            <h3 className="lqr-modal__title">{title}</h3>
            {subtitle && <p className="lqr-modal__sub">{subtitle}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="lqr-modal__close"
            onClick={onClose}
            aria-label={closeLabel}
            disabled={busy}
          >
            <X size={18} />
          </button>
        </div>

        <div className="lqr-modal__body">{children}</div>

        {footer && <div className="lqr-modal__foot">{footer}</div>}
      </motion.div>
    </motion.div>
  );
}
