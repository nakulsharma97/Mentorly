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
