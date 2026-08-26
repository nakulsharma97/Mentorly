/**
 * Shared profile-completion helpers for the mandatory onboarding flow.
 *
 * The source of truth is the `profileCompleted` boolean persisted on the
 * backend. Fallbacks keep older backend responses (which only exposed a
 * computed percentage) and test fixtures working until they are migrated.
 */

export const PROFILE_ONBOARDING_PATH = "/complete-profile";

/**
 * Per-session onboarding dismissal. A mentor who closes the Complete Profile
 * page may continue exploring their dashboard — the mandatory redirect is
 * bypassed for this browser session only (cleared on logout + fresh login,
 * so a new login always re-triggers onboarding while the profile is
 * incomplete).
 */
export const ONBOARDING_DISMISS_KEY = "mentorly:onboarding_dismissed";

export function isOnboardingDismissed() {
  try {
    return sessionStorage.getItem(ONBOARDING_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissOnboarding() {
  try {
    sessionStorage.setItem(ONBOARDING_DISMISS_KEY, "1");
  } catch {
    // storage unavailable — treat as dismissed for this render anyway
  }
}

export function clearOnboardingDismissal() {
  try {
    sessionStorage.removeItem(ONBOARDING_DISMISS_KEY);
  } catch {
    // ignore
  }
}

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

  // Last-resort fallback for pre-onboarding payloads (e.g. unit tests):
  // derive from the SAME mirror formula so every code path agrees.
  return computeProfileCompletion(profile, profile.role) >= 100;
}

/** True when the user is logged in, checked, not an admin, and must onboard. */
export function needsOnboarding(profile, profileChecked) {
  if (!profileChecked || !profile) return false;
  return profile.role !== "ADMIN" && !isProfileComplete(profile);
}

/* ─────────────────────────────────────────────────────────────
   ONE frontend mirror of the backend ProfileCompletionService
   ─────────────────────────────────────────────────────────────
   The backend is the single source of truth: every persisted surface reads
   `profile.profileCompletionPercent` / `profile.profileCompletionSections`
   from the API. The ONLY place this preview is used is the live progress bar
   on the onboarding form, so a mentor sees their percentage update as they
   type — it mirrors the backend formula exactly (same sections, same
   weights) and must be kept in sync with
   com.mentorly.common.ProfileCompletionService.

   Mentor: 5 sections × 20% — Basic · Skills & Pricing · Experience ·
   Portfolio & Links · Contact.
   Learner: 4 sections × 25% — Basic · Skills & Goals · Learning Goals ·
   Contact.
   ───────────────────────────────────────────────────────────── */

export const PROFILE_COMPLETION_SECTIONS = [
  { key: "basic", label: "Basic Information" },
  { key: "skills", label: "Skills & Pricing" },
  { key: "experience", label: "Experience" },
  { key: "portfolio", label: "Portfolio & Links" },
  { key: "contact", label: "Contact & Location" },
];

function hasValue(value) {
  return Boolean(String(value ?? "").trim());
}

/** Accepts a profile-shaped object (same keys as the backend User entity). */
export function computeProfileCompletion(profile, role) {
  if (!profile || role === "ADMIN") return 100;
  if (role === "MENTOR") {
    const basic = [
      hasValue(profile.fullName),
      hasValue(profile.profileImageUrl),
      hasValue(profile.aboutMe),
    ];
    const hourlyRateSet =
      profile.hourlyRate !== undefined &&
      profile.hourlyRate !== null &&
      profile.hourlyRate !== "" &&
      Number(profile.hourlyRate) >= 0;
    const skills = [
      hasValue(profile.skills),
      hasValue(profile.languages),
      hasValue(profile.education),
      hourlyRateSet,
    ];
    // 0 years is a valid fresher answer — filled as soon as it is chosen.
    const experience = [
      profile.yearsOfExperience !== undefined &&
        profile.yearsOfExperience !== null &&
        profile.yearsOfExperience !== "" &&
        Number(profile.yearsOfExperience) >= 0,
    ];
    const portfolio = [
      hasValue(profile.linkedinUrl) ||
        hasValue(profile.portfolioUrl) ||
        hasValue(profile.githubUrl) ||
        hasValue(profile.projects),
    ];
    const contact = [
      hasValue(profile.country),
      hasValue(profile.state),
      hasValue(profile.city),
      hasValue(profile.timezone),
      hasValue(profile.availability),
    ];
    const sections = [basic, skills, experience, portfolio, contact];
    const total = sections.reduce(
      (sum, section) => sum + 20 * (section.filter(Boolean).length / section.length),
      0,
    );
    return Math.min(100, Math.round(total));
  }

  // LEARNER — 4 sections × 25%
  const basic = [
    hasValue(profile.fullName),
    hasValue(profile.profileImageUrl),
    hasValue(profile.aboutMe),
  ];
  const skills = [
    hasValue(profile.skills),
    hasValue(profile.currentSkillLevel),
    hasValue(profile.languages),
  ];
  const goals = [hasValue(profile.learningGoals)];
  const contact = [
    hasValue(profile.country),
    hasValue(profile.state),
    hasValue(profile.city),
    hasValue(profile.timezone),
    hasValue(profile.phoneNumber),
  ];
  const total = [basic, skills, goals, contact].reduce(
    (sum, section) => sum + 25 * (section.filter(Boolean).length / section.length),
    0,
  );
  return Math.min(100, Math.round(total));
}

/**
 * Mirror of the backend's per-section status list ({ key, label, filled,
 * required, done }). Used as a fallback when an API response predates
 * `profileCompletionSections` (checklists, hero widgets, admin views).
 */
export function computeProfileCompletionSections(profile, role) {
  if (!profile || role === "ADMIN") {
    return [];
  }
  if (role === "MENTOR") {
    return [
      {
        key: "basic",
        label: "Basic Information",
        filled: [hasValue(profile.fullName), hasValue(profile.profileImageUrl), hasValue(profile.aboutMe)].filter(Boolean).length,
        required: 3,
      },
      {
        key: "skills",
        label: "Skills & Pricing",
        filled: [
          hasValue(profile.skills),
          hasValue(profile.languages),
          hasValue(profile.education),
          profile.hourlyRate !== undefined &&
            profile.hourlyRate !== null &&
            profile.hourlyRate !== "" &&
            Number(profile.hourlyRate) >= 0,
        ].filter(Boolean).length,
        required: 4,
      },
      {
        key: "experience",
        label: "Experience",
        filled:
          profile.yearsOfExperience !== undefined &&
          profile.yearsOfExperience !== null &&
          profile.yearsOfExperience !== "" &&
          Number(profile.yearsOfExperience) >= 0
            ? 1
            : 0,
        required: 1,
      },
      {
        key: "portfolio",
        label: "Portfolio & Links",
        filled:
          hasValue(profile.linkedinUrl) ||
          hasValue(profile.portfolioUrl) ||
          hasValue(profile.githubUrl) ||
          hasValue(profile.projects)
            ? 1
            : 0,
        required: 1,
      },
      {
        key: "contact",
        label: "Contact & Location",
        filled: [
          hasValue(profile.country),
          hasValue(profile.state),
          hasValue(profile.city),
          hasValue(profile.timezone),
          hasValue(profile.availability),
        ].filter(Boolean).length,
        required: 5,
      },
    ].map((s) => ({ ...s, done: s.filled >= s.required }));
  }
  return [
    {
      key: "basic",
      label: "Basic Information",
      filled: [hasValue(profile.fullName), hasValue(profile.profileImageUrl), hasValue(profile.aboutMe)].filter(Boolean).length,
      required: 3,
    },
    {
      key: "skills",
      label: "Skills & Goals",
      filled: [hasValue(profile.skills), hasValue(profile.currentSkillLevel), hasValue(profile.languages)].filter(Boolean).length,
      required: 3,
    },
    {
      key: "goals",
      label: "Learning Goals",
      filled: hasValue(profile.learningGoals) ? 1 : 0,
      required: 1,
    },
    {
      key: "contact",
      label: "Contact & Location",
      filled: [hasValue(profile.country), hasValue(profile.state), hasValue(profile.city), hasValue(profile.timezone), hasValue(profile.phoneNumber)].filter(Boolean).length,
      required: 5,
    },
  ].map((s) => ({ ...s, done: s.filled >= s.required }));
}
