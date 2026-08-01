import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./ReportModal.css";

const TARGET_META = {
  MENTOR: { label: "Mentor", icon: "badge", reasons: ["Inappropriate behavior", "Fake profile or identity", "Harassment or abuse", "Misleading or harmful content", "Spam or scam", "Other"] },
  LEARNER: { label: "Learner", icon: "person", reasons: ["Inappropriate behavior", "Harassment or abuse", "Fake account", "Spam or scam", "Other"] },
  SESSION: { label: "Session", icon: "event", reasons: ["Misleading description", "No-show or late cancellation", "Inappropriate content", "Payment or pricing issue", "Technical issue", "Other"] },
  SKILL: { label: "Skill", icon: "school", reasons: ["Duplicate or spam skill", "Misleading category", "Inappropriate name", "Other"] },
};

/**
 * Reusable modal for reporting a Mentor, Learner, Session, or Skill.
 *
 * @param {object} props
 * @param {"MENTOR"|"LEARNER"|"SESSION"|"SKILL"} props.targetType
 * @param {number} [props.targetId] session/skill id (required for SESSION/SKILL)
 * @param {number} [props.targetUserId] reported user id (required for MENTOR/LEARNER)
 * @param {string} [props.targetLabel] display label, defaults from targetType
 * @param {Function} [props.onClose]
 * @param {Function} [props.notify]
 */
export default function ReportModal({ targetType, targetId, targetUserId, targetLabel, onClose, notify }) {
  const type = (targetType || "MENTOR").toUpperCase();
  const meta = TARGET_META[type] || TARGET_META.MENTOR;

  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const reasons = useMemo(() => meta.reasons, [meta]);

  const close = useCallback(() => {
    if (submitting) return;
    onClose?.();
  }, [submitting, onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  const submit = async () => {
    if (!reason.trim()) {
      setError("Please choose a reason.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await client.post("/api/v1/safety/report", {
        reportedUserId: targetUserId ?? null,
        targetType: type,
        targetId: targetId ?? null,
        reason: reason.trim(),
        details: details.trim() || null,
      });
      notify?.({ type: "success", title: "Report submitted", message: "Our team will review this report. Thank you for keeping SkillSwap safe." });
      onClose?.();
    } catch (err) {
      const msg = err?.response?.data?.data?.error || err?.response?.data?.message || err?.message || "Could not submit the report. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="rm-modal" role="dialog" aria-modal="true" aria-label={`Report ${meta.label.toLowerCase()}`}>
        <div className="rm-modal__head">
          <span className="rm-modal__icon"><Icon name={meta.icon} /></span>
          <div>
            <p className="rm-modal__eyebrow">Report a problem</p>
            <h2>Report {meta.label.toLowerCase()}</h2>
          </div>
          <button type="button" className="rm-modal__close" onClick={close} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        {targetLabel && (
          <div className="rm-modal__target">
            <Icon name="flag" />
            <span>{targetLabel}</span>
          </div>
        )}

        <div className="rm-modal__body">
          <label className="rm-field">
            <span className="rm-field__label">Why are you reporting?</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choose a reason…</option>
              {reasons.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>

          <label className="rm-field">
            <span className="rm-field__label">Details (optional)</span>
            <textarea
              rows={4}
              placeholder="Share any additional context so our team can investigate…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
          </label>

          {error && (
            <div className="rm-error">
              <Icon name="error" /> {error}
            </div>
          )}

          <div className="rm-note">
            <Icon name="verified_user" />
            Reports are confidential. False reports may result in action against your account.
          </div>
        </div>

        <div className="rm-modal__actions">
          <button type="button" className="rm-btn rm-btn--ghost" onClick={close} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="rm-btn rm-btn--primary" onClick={submit} disabled={submitting}>
            <Icon name="flag" />
            {submitting ? "Submitting…" : "Submit Report"}
          </button>
        </div>
      </div>
    </div>
  );
}
