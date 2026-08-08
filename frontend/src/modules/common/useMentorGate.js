/**
 * useMentorGate — single source of truth for "can this mentor use marketplace
 * features?" Used by the dashboard, TeachingPage and Calendar to decide
 * whether a blocked action should open the ProfileGateModal.
 *
 * Returns:
 *   mode   — null when the mentor can proceed, otherwise one of
 *            "incomplete" | "pending" | "moreInfo" | "rejected" | "suspended"
 *   gate   — { open, onClose, onCompleteProfile } spread onto ProfileGateModal
 *   canUse — shortcut boolean (mode === null)
 */
import { useCallback, useState } from "react";

export function resolveMentorGateMode(profile, verificationStatus) {
  if (!profile || profile.role !== "MENTOR" || profile.role === "ADMIN") return null;

  // Verification status from the mentor-status API takes precedence when
  // present (it carries REJECTED / SUSPENDED distinctions the profile DTO
  // does not expose).
  const status = verificationStatus?.verificationStatus || null;
  if (status === "REJECTED") return "rejected";
  if (status === "SUSPENDED") return "suspended";
  if (status === "MORE_INFORMATION_REQUIRED") return "moreInfo";
  if (status === "UNDER_REVIEW" || status === "PENDING") return "pending";

  // Fall back to the profile flags.
  if (profile.profileCompleted === false) return "incomplete";
  if (!profile.mentorVerified) return "pending";
  return null;
}

export default function useMentorGate(profile, verificationStatus) {
  const [open, setOpen] = useState(false);
  const mode = resolveMentorGateMode(profile, verificationStatus);

  const requestAction = useCallback(
    (action) => {
      // If the mentor is blocked, open the gate instead of running the action.
      if (mode) {
        setOpen(true);
        return;
      }
      action?.();
    },
    [mode],
  );

  return {
    mode,
    canUse: mode === null,
    requestAction,
    gate: {
      open,
      mode,
      onClose: () => setOpen(false),
      // The modal's primary CTA is a <Link> that owns navigation — closing
      // the modal here avoids any double-navigation.
      onCompleteProfile: () => setOpen(false),
    },
  };
}
