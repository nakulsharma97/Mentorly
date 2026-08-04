import { motion } from "framer-motion";
import useModalA11y from "../components/reports/useModalA11y";
import AuButton from "./AuButton";

/**
 * AuModal — unified confirm modal. `tone` = danger | primary | default.
 * Escape / backdrop close + focus management are handled by useModalA11y.
 */
export default function AuModal({
  open,
  title,
  description,
  icon: Icon,
  tone = "default",
  confirmLabel = "Confirm",
  busy = false,
  children,
  onClose,
  onConfirm,
  cancelLabel = "Cancel",
}) {
  const modalRef = { current: null };
  useModalA11y({ open, onClose, busy, dialogRef: modalRef });

  return (
    <motion.div
      className="au-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <motion.div
        ref={(node) => { modalRef.current = node; }}
        className="au-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      >
        {Icon && (
          <span className={`au-modal__icon${tone === "danger" ? " au-modal__icon--danger" : ""}`} aria-hidden="true">
            <Icon size={22} />
          </span>
        )}
        <h3>{title}</h3>
        {description && <p className="au-modal__desc">{description}</p>}
        {children && <div className="au-modal__body">{children}</div>}
        <div className="au-modal__foot">
          <AuButton onClick={onClose} disabled={busy}>
            {cancelLabel}
          </AuButton>
          <AuButton variant={tone === "danger" ? "danger" : "primary"} disabled={busy} onClick={onConfirm}>
            {busy ? "Working…" : confirmLabel}
          </AuButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
