/**
 * Idle-time prefetching for lazily-loaded workspace pages.
 *
 * Routes are code-split with React.lazy (see components/AppRoutes.jsx), so the
 * first click on a sidebar link must download + transform that page's chunk
 * before it can render. This module warms the most commonly visited pages in
 * the background (during browser idle time, after the initial route has
 * painted) so the first navigation to those pages renders immediately instead
 * of showing a loading skeleton while the chunk loads.
 *
 * Safe by design: import() only evaluates the page module — components are
 * not mounted and no API calls are made until the user actually navigates.
 */

const MENTOR_PAGES = [
  () => import("../../pages/MentorDashboard"),
  () => import("../../pages/MentorStudentsPage"),
  () => import("../../pages/MentorReviewsPage"),
  () => import("../../pages/MentorCalendarPage"),
  () => import("../../pages/MessagesPage"),
  () => import("../../pages/MentorNotificationsPage"),
  () => import("../../pages/MentorSettingsPage"),
  () => import("../../pages/AnalyticsPage"),
  () => import("../../pages/TeachingPage"),
];

const LEARNER_PAGES = [
  () => import("../../pages/LearnerDashboard"),
  () => import("../../pages/LearnerMentorsPage"),
  () => import("../../pages/LearnerSkillsPage"),
  () => import("../../pages/LearnerLearningPage"),
  () => import("../../pages/LearnerTasksPage"),
  () => import("../../pages/LearnerSessionsPage"),
  () => import("../../pages/LearnerMessagesPage"),
  () => import("../../pages/LearnerSavedMentorsPage"),
];

const ADMIN_PAGES = [
  () => import("../../pages/AdminDashboardPage"),
  () => import("../../pages/UserManagementPage"),
  () => import("../../pages/SessionManagementPage"),
];

// Load in small batches so an idle-time prefetch never bursts a slow network
// with every chunk at once and competes with the user's first interactions.
const BATCH_SIZE = 3;
const BATCH_GAP_MS = 400;

function prefetch(loaders) {
  const batch = loaders.slice(0, BATCH_SIZE);
  const rest = loaders.slice(BATCH_SIZE);
  for (const load of batch) {
    // Never let a failed prefetch reject into the console or crash the app.
    load().catch(() => {});
  }
  if (rest.length > 0) {
    window.setTimeout(() => prefetch(rest), BATCH_GAP_MS);
  }
}

/**
 * Warm the chunks for the most common pages of the given role.
 * Called once the user is authenticated and the initial route has settled.
 */
export function prefetchWorkspacePages(role) {
  const normalized = String(role || "").toUpperCase();
  const loaders =
    normalized === "MENTOR"
      ? MENTOR_PAGES
      : normalized === "LEARNER"
        ? LEARNER_PAGES
        : normalized === "ADMIN"
          ? ADMIN_PAGES
          : null;
  if (!loaders) return;

  const run = () => prefetch(loaders);
  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else if (typeof window !== "undefined") {
    window.setTimeout(run, 800);
  } else {
    run();
  }
}
