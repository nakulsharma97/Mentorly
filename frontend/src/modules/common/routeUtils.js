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

/**
 * Role-correct path to the messaging workspace, optionally deep-linked into
 * one conversation.
 *
 * /learner/messages and /mentor/messages are separate routes behind their
 * role's layout + RoleGuard, so a mentor must never be sent to the learner
 * path (it would bounce them out of the page). Admins have no messaging
 * workspace at all — they land on their dashboard instead of a blocked route.
 *
 * @param {string|null|undefined} role  viewer's role (LEARNER / MENTOR / ADMIN)
 * @param {string|number|null|undefined} [conversationId]  optional deep link
 * @returns {string}
 */
export function messagesPath(role, conversationId) {
  if (role === "ADMIN") {
    return ADMIN_DASHBOARD;
  }
  const root = role === "MENTOR" ? MENTOR_ROOT : LEARNER_ROOT;
  return conversationId
    ? `${root}/messages/${conversationId}`
    : `${root}/messages`;
}

/* ── Post-login destination ("Share Your Review", mentor deep links) ── */

/** localStorage key holding the page the user wanted before authenticating. */
export const POST_LOGIN_REDIRECT_KEY = "auth_post_redirect";

/**
 * Landing-page "Share Your Review" destination: the site-wide review page
 * (/share-review) where any signed-in learner or mentor can submit one
 * review of the Mentorly platform itself (admin-moderated before it
 * appears on the landing page).
 *
 * Kept role-agnostic: AppRoutes' /share-review route resolves it to the
 * role's workspace layout path (/learner/share-review or
 * /mentor/share-review), so post-login redirects and onboarding always
 * land on the page WITH its navbar/sidebar.
 */
export const REVIEW_DESTINATION = "/share-review";

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
