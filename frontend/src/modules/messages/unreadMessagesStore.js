/**
 * Global unread-message counter (booking chats + direct chats combined).
 *
 * This is a tiny module-level pub/sub store so the workspace sidebar badge can
 * subscribe to the total even when the messages page (MessageApp) is not
 * mounted. Writers:
 *  - MessageApp publishes the live sum whenever its conversation list changes
 *    (real-time path while the user is on the messages page).
 *  - The workspace shell polls the chat endpoints and publishes the same sum
 *    (refresh path on every other page).
 *
 * The value is always backend-driven — the client never fabricates counts.
 */

let count = 0;
const listeners = new Set();

export function getUnreadMessages() {
  return count;
}

/** Set the total. No-op when unchanged so subscribers only re-render on real changes. */
export function setUnreadMessages(next) {
  const safe = Math.max(0, Number(next) || 0);
  if (safe === count) return;
  count = safe;
  listeners.forEach((cb) => {
    try {
      cb(count);
    } catch {
      // a subscriber must never break the store
    }
  });
}

/** Subscribe to count changes; returns an unsubscribe function. */
export function subscribeUnreadMessages(cb) {
  listeners.add(cb);
  cb(count);
  return () => listeners.delete(cb);
}

export function formatUnreadCount(value) {
  const n = Math.max(0, Number(value) || 0);
  return n > 99 ? "99+" : String(n);
}

/**
 * Build the browser-tab title for a workspace page.
 *
 * Prefixes the page title with the unread count when present and strips any
 * stale prefix first so re-applying is idempotent:
 *   formatTabTitle("Reviews | Mentorly", 0) -> "Reviews | Mentorly"
 *   formatTabTitle("Reviews | Mentorly", 3) -> "(3) Reviews | Mentorly"
 *   formatTabTitle("(3) Reviews | Mentorly", 5) -> "(5) Reviews | Mentorly"
 */
export function formatTabTitle(currentTitle, unread) {
  const base = (currentTitle || "Mentorly").replace(/^\(\d+\+?\)\s*/u, "");
  return unread > 0 ? `(${formatUnreadCount(unread)}) ${base}` : base;
}
