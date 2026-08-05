import { useEffect, useState } from "react";
import client from "../../../api/client";
import { unwrap } from "../../messages/utils";
import {
  getUnreadMessages,
  subscribeUnreadMessages,
  setUnreadMessages,
} from "../../messages/unreadMessagesStore";

const POLL_INTERVAL_MS = 45000;

/** Sum of unread counts across both chat endpoints (archived excluded). */
async function fetchUnreadTotal() {
  const [bookingRes, directRes] = await Promise.all([
    client.get("/api/v1/chat/conversations").catch(() => ({ data: { data: [] } })),
    client.get("/api/v1/chat/direct/conversations").catch(() => ({ data: { data: [] } })),
  ]);
  const bookingRows = unwrap(bookingRes.data) || [];
  const directRows = unwrap(directRes.data) || [];
  const bookingUnread = bookingRows.reduce(
    (sum, c) => sum + (Number(c?.unreadCount) || 0),
    0,
  );
  const directUnread = directRows
    .filter((c) => !c?.archived)
    .reduce((sum, c) => sum + (Number(c?.unreadCount) || 0), 0);
  return bookingUnread + directUnread;
}

/**
 * Live subscription to the global unread message count. Re-renders only when
 * the value actually changes (store dedupes identical values).
 */
export function useUnreadMessageCount() {
  const [count, setCount] = useState(getUnreadMessages);

  useEffect(() => {
    return subscribeUnreadMessages(setCount);
  }, []);

  return count;
}

/**
 * Backend-driven polling for the unread message count. Runs in the workspace
 * shell so the sidebar badge stays correct on every page, not just the
 * messages page. Polls on an interval, on window focus, and on tab visibility
 * becoming visible. Pauses while the tab is hidden.
 *
 * @param profile the current user profile (used to restrict polling to
 *        messaging-capable roles).
 */
export function useUnreadMessagePolling(profile) {
  const role = String(profile?.role || "").toUpperCase();

  useEffect(() => {
    if (role !== "MENTOR" && role !== "LEARNER") return undefined;

    let alive = true;
    let timer = null;
    let inFlight = false;

    const poll = async () => {
      if (!alive || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      // fetchUnreadTotal never rejects (per-request fallbacks), so a failed
      // request simply publishes a lower/zero total; the next poll retries.
      const total = await fetchUnreadTotal();
      inFlight = false;
      if (alive) setUnreadMessages(total);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    const onFocus = () => poll();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    timer = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [role]);
}
