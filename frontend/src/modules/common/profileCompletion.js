/**
 * Shared profile-completion helpers for the mandatory onboarding flow.
 *
 * The source of truth is the `profileCompleted` boolean persisted on the
 * backend. Fallbacks keep older backend responses (which only exposed a
 * computed percentage) and test fixtures working until they are migrated.
 */

export const PROFILE_ONBOARDING_PATH = "/complete-profile";

export function isProfileComplete(profile) {
  if (!profile) return false;
  if (profile.role === "ADMIN") return true;

  // Server-persisted flag — the authoritative signal.
  if (typeof profile.profileCompleted === "boolean") {
    return profile.profileCompleted;
  }

  // Legacy backend response: percentage-based completion.
  if (typeof profile.profileCompletionPercent === "number") {
    return profile.profileCompletionPercent >= 100;
  }

  // Last-resort heuristic for pre-onboarding payloads (e.g. unit tests).
  return Boolean(
    String(profile.skills || "").trim() &&
      String(profile.aboutMe || "").trim() &&
      String(profile.githubUrl || "").trim() &&
      String(profile.linkedinUrl || "").trim(),
  );
}

/** True when the user is logged in, checked, not an admin, and must onboard. */
export function needsOnboarding(profile, profileChecked) {
  if (!profileChecked || !profile) return false;
  return profile.role !== "ADMIN" && !isProfileComplete(profile);
}
