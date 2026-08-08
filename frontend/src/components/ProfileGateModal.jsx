import { useEffect, useRef } from "react";
import { Link } from "react-router";
import SsIcon from "./ui/SsIcon";
import "./ProfileGateModal.css";

/**
 * ProfileGateModal — the professional "Complete Your Profile First" gate.
 *
 * Shown whenever a mentor whose profile is incomplete (or not yet admin
 * verified) tries a marketplace action: create / publish a session, set
 * availability, or accept a booking. Gives them one clear path (Complete
 * Profile) plus a Cancel escape hatch, so the mentor always understands WHY
 * the action is disabled.
 *
 * mode:
 *   "incomplete" — profileCompleted === false (must finish onboarding first)
 *   "pending"    — submitted, awaiting admin approval
 *   "moreInfo"   — admin requested additional information, must update + resubmit
 *   "rejected"   — admin rejected, needs rework + resubmit
 *   "suspended"  — admin suspended the account
 */
export default function ProfileGateModal({
  open,
  mode = "incomplete",
  onClose,
  onCompleteProfile,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => dialogRef.current?.focus(), 60);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = {
    incomplete: {
      icon: "edit",
      tone: "amber",
      title: "Complete Your Profile First",
      message:
        "Before creating mentoring sessions, you must complete your profile. After submitting your profile, our Admin team will review your account. Verification is usually completed within 24 hours.",
      primary: "Complete Profile",
      to: "/complete-profile",
    },
    pending: {
      icon: "manage_search",
      tone: "blue",
      title: "Verification in Progress",
      message:
        "Your profile has been submitted successfully. Our Admin team is reviewing your account. Expected review time: within 24 hours. You will be able to create sessions and appear in search as soon as you are approved.",
      primary: "View Status",
      to: "/mentor/dashboard",
    },
    moreInfo: {
      icon: "edit_note",
      tone: "amber",
      title: "Additional Information Required",
      message:
        "The Admin has requested additional information before approving your profile. Please review the required changes, update your profile, and submit it again for review.",
      primary: "Update Profile",
      to: "/complete-profile",
    },
    rejected: {
      icon: "cancel",
      tone: "red",
      title: "Profile Verification Rejected",
      message:
        "Your profile requires some changes before it can be approved. Please review the Admin's feedback, update your profile, and submit it again.",
      primary: "Update Profile",
      to: "/complete-profile",
    },
    suspended: {
      icon: "block",
      tone: "red",
      title: "Mentor Account Suspended",
      message:
        "Your mentor account is currently suspended. Marketplace features are disabled until an admin reviews your account.",
      primary: "View Status",
      to: "/mentor/dashboard",
    },
  }[mode] || {
    icon: "shield",
    tone: "amber",
    title: "Mentor verification required",
    message:
      "This action requires an admin-verified mentor account.",
    primary: "View Status",
    to: "/mentor/dashboard",
  };

  return (
    <div className="pgm-overlay" role="presentation">
      <div
        className="pgm-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pgm-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <button
          type="button"
          className="pgm-close"
          onClick={onClose}
          aria-label="Close dialog"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={`pgm-icon pgm-icon--${content.tone}`}>
          <SsIcon name={content.icon} size={26} />
        </div>

        <h3 id="pgm-title" className="pgm-title">{content.title}</h3>
        <p className="pgm-message">{content.message}</p>

        {mode === "pending" && (
          <span className="pgm-badge pgm-badge--pending">Pending Verification</span>
        )}

        <div className="pgm-actions">
          <button type="button" className="pgm-btn pgm-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <Link
            to={content.to}
            className="pgm-btn pgm-btn--primary"
            onClick={onCompleteProfile}
          >
            <SsIcon name="arrow_forward" size={16} />
            {content.primary}
          </Link>
        </div>
      </div>
    </div>
  );
}
