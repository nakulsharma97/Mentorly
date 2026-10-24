export const LEARNER_ROOT = "/learner";
export const MENTOR_ROOT = "/mentor";
export const ADMIN_ROOT = "/admin";
export const LEARNER_DASHBOARD = `${LEARNER_ROOT}/dashboard`;
export const MENTOR_DASHBOARD = `${MENTOR_ROOT}/dashboard`;
export const ADMIN_DASHBOARD = `${ADMIN_ROOT}/dashboard`;

export const roleRoot = (role) => {
  if (role === "ADMIN") {
    return ADMIN_DASHBOARD;
  }
  if (role === "MENTOR") {
    return MENTOR_DASHBOARD;
  }
  return LEARNER_DASHBOARD;
};

export const getRoleHomePath = (pathname) => {
  if (!pathname) {
    return LEARNER_DASHBOARD;
  }

  if (
    pathname.startsWith(MENTOR_ROOT) ||
    pathname.startsWith("/teach") ||
    pathname.startsWith("/analytics") ||
    pathname.startsWith("/professional-profile")
  ) {
    return MENTOR_DASHBOARD;
  }

  if (pathname.startsWith(ADMIN_ROOT) || pathname.startsWith("/executive")) {
    return ADMIN_DASHBOARD;
  }

  return LEARNER_DASHBOARD;
};

export const isPublicPath = (path) => {
  return ["/", "/login", "/signup", "/test-checklist"].includes(path);
};

/* ── Post-login destination ("Share Your Review", mentor deep links) ── */

/** localStorage key holding the page the user wanted before authenticating. */
export const POST_LOGIN_REDIRECT_KEY = "auth_post_redirect";

/**
 * Landing-page "Share Your Review" destination: the learner sessions page
 * opened on the Completed tab, with a review-intent flag so the page can
 * explain how to leave a review (deep-link also works without the flag).
 */
export const REVIEW_DESTINATION = "/learner/sessions?tab=completed&review=1";

/**
 * Only internal app paths may be used as a post-login destination — rejects
 * absolute (https://…) and protocol-relative (//host, /\host) values so a
 * tampered redirect can never leave the app (open-redirect protection).
 */
export const isSafeInternalPath = (value) =>
  typeof value === "string" &&
  value.startsWith("/") &&
  !value.startsWith("//") &&
  !value.startsWith("/\\");

/**
 * Read AND clear the pending destination in one step (single consumer
 * pattern: whoever reads it consumes it). Returns null when absent or unsafe.
 */
export const consumePostLoginRedirect = () => {
  let raw = null;
  try {
    raw = localStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    localStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    // storage unavailable — treat as absent
  }
  return isSafeInternalPath(raw) ? raw : null;
};
