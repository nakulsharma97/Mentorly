import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import { unwrap } from "../modules/messages/utils";
import { setUnreadMessages } from "../modules/messages/unreadMessagesStore";

const ChatContext = createContext(null);

const POLL_INTERVAL_MS = 45_000;

/**
 * ChatProvider — mounted once at the WorkspaceLayout level. Fetches both
 * booking-chat and direct-chat conversations, merges them into one sorted
 * list, and exposes:
 *
 *  1. The full merged conversation list for MessageApp (replaces
 *     useConversations).
 *  2. The unread total published to the shared unreadMessagesStore (replaces
 *     useUnreadMessagePolling).
 *  3. A load() function for silent background refreshes (post-send, post-
 *     selection, incoming WS message).
 *
 * Because the provider lives at the layout level it persists across child-
 * page navigations, so conversations are fetched exactly once per layout
 * mount — not once per route change within the same role workspace.
 */
export function ChatProvider({ profile, children }) {
  const currentUserId = profile?.id;
  const role = String(profile?.role || "").toUpperCase();

  const [bookingConvs, setBookingConvs] = useState([]);
  const [directConvs, setDirectConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const inflightRef = useRef(null);
  const roleRef = useRef(role);
  roleRef.current = role;

  /** Fetch both conversation endpoints. Deduplicates in-flight requests. */
  const load = useCallback(async ({ silent } = {}) => {
    if (!currentUserId) {
      setBookingConvs([]);
      setDirectConvs([]);
      setLoading(false);
      return;
    }
    if (inflightRef.current) return inflightRef.current;

    if (!silent) setLoading(true);
    setError(null);

    inflightRef.current = (async () => {
      try {
        const [bookingRes, directRes] = await Promise.all([
          client.get("/api/v1/chat/conversations").catch(() => ({ data: { data: [] } })),
          client.get("/api/v1/chat/direct/conversations").catch(() => ({ data: { data: [] } })),
        ]);
        setBookingConvs(unwrap(bookingRes.data) || []);
        setDirectConvs(unwrap(directRes.data) || []);
      } catch {
        setError("Conversations could not be loaded.");
      } finally {
        if (!silent) setLoading(false);
        inflightRef.current = null;
      }
    })();

    return inflightRef.current;
  }, [currentUserId]);

  // Initial fetch on mount (or when userId changes)
  useEffect(() => {
    load();
  }, [load]);

  /** Merge both kinds into unified rows — exactly ONE row per person. */
  const conversations = useMemo(() => {
    const rows = [
      ...(bookingConvs || []).map((c) => ({
        id: `booking-${c.bookingId}`,
        kind: "booking",
        convId: String(c.bookingId),
        conversation: c,
        title: c.participantName || c.sessionTitle || "Mentorly Member",
        subtitle: c.lastMessagePreview || c.sessionTitle || "",
        role: c.participantRole || "",
        email: c.participantEmail || "",
        time: c.lastMessageAt || "",
        unreadCount: Number(c.unreadCount || 0),
        online: Boolean(c.participantOnline),
        presence: c.participantPresenceText || "Offline",
        sessionTitle: c.sessionTitle || "",
        sessionCount: Math.max(1, Number(c.sessionCount || 1)),
        participantId: c.participantId,
      })),
      ...(directConvs || []).map((c) => ({
        id: `direct-${c.conversationId}`,
        kind: "direct",
        convId: String(c.conversationId),
        conversation: c,
        title: c.participantName || "Mentorly Member",
        subtitle: c.lastMessagePreview || "Direct conversation",
        role: c.participantRole || "",
        email: c.participantEmail || "",
        time: c.lastMessageAt || "",
        unreadCount: Number(c.unreadCount || 0),
        online: Boolean(c.participantOnline),
        presence: c.participantPresenceText || "Offline",
        pinned: Boolean(c.pinned),
        archived: Boolean(c.archived),
        sessionTitle: "",
        sessionCount: 0,
        participantId: c.participantId,
      })),
    ];

    const byParticipant = new Map();
    for (const row of rows) {
      const key =
        row.participantId != null
          ? `p-${row.participantId}`
          : `${row.kind}-${row.convId}`;
      const existing = byParticipant.get(key);
      if (!existing) {
        byParticipant.set(key, {
          ...row,
          threads: [{ kind: row.kind, convId: row.convId }],
        });
        continue;
      }
      const rowTime = new Date(row.time || 0).getTime();
      const existingTime = new Date(existing.time || 0).getTime();
      const newer = rowTime >= existingTime ? row : existing;
      byParticipant.set(key, {
        ...newer,
        time: newer.time || existing.time || row.time,
        subtitle:
          rowTime >= existingTime
            ? row.subtitle || existing.subtitle
            : existing.subtitle || row.subtitle,
        unreadCount: existing.unreadCount + row.unreadCount,
        sessionCount: Math.max(existing.sessionCount || 0, row.sessionCount || 0),
        threads: [
          ...(existing.threads || [{ kind: existing.kind, convId: existing.convId }]),
          { kind: row.kind, convId: row.convId },
        ],
      });
    }

    const merged = [...byParticipant.values()];
    merged.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    return merged;
  }, [bookingConvs, directConvs]);

  /** Client-side filter for inbox tabs and chips. */
  const filterConversations = useCallback(
    (filter, sort) => {
      let next = conversations;
      const f = String(filter || "all").toLowerCase();
      if (f === "unread") next = next.filter((c) => c.unreadCount > 0);
      else if (f === "read") next = next.filter((c) => c.unreadCount === 0);
      else if (f === "pinned") next = next.filter((c) => c.pinned);
      else if (f === "mentors")
        next = next.filter((c) => String(c.role).toUpperCase() === "MENTOR");
      else if (f === "learners" || f === "students")
        next = next.filter((c) => String(c.role).toUpperCase() === "LEARNER");
      else if (f === "archived") next = next.filter((c) => c.archived);
      else if (f === "active-session") {
        next = next.filter((c) => {
          const status = String(c?.conversation?.bookingStatus || "").toUpperCase();
          return c.kind === "booking" && ["ACCEPTED", "CONFIRMED", "IN_PROGRESS"].includes(status);
        });
      }

      if (String(sort || "").toLowerCase() === "oldest") {
        next = [...next].sort((a, b) => new Date(a.time || 0) - new Date(b.time || 0));
      }
      return next;
    },
    [conversations],
  );

  /** Optimistic updater for the direct-conversations list. */
  const patchDirect = useCallback((updater) => {
    setDirectConvs((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  }, []);

  // --- Unread-count derivation + store publication ---
  const totalUnread = useMemo(
    () =>
      conversations.reduce(
        (sum, c) => sum + (!c.archived ? Number(c.unreadCount || 0) : 0),
        0,
      ),
    [conversations],
  );

  // Publish the live unread total to the shared store (sidebar badge + tab title).
  useEffect(() => {
    setUnreadMessages(totalUnread);
  }, [totalUnread]);

  // --- Background polling (only when NOT on the messages page) ---
  useEffect(() => {
    // Learner and mentor roles get background polling for the sidebar badge.
    // Admin doesn't need it — no chat badge for admins.
    if (role !== "MENTOR" && role !== "LEARNER") return undefined;

    let alive = true;
    let timer = null;

    const poll = async () => {
      if (!alive || document.visibilityState === "hidden") return;
      await load({ silent: true });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    const onFocus = () => poll();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    timer = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
    };
  }, [role, load]);

  const value = useMemo(
    () => ({
      conversations,
      bookingConvs,
      directConvs,
      loading,
      error,
      load,
      filterConversations,
      patchDirect,
      totalUnread,
    }),
    [conversations, bookingConvs, directConvs, loading, error, load, filterConversations, patchDirect, totalUnread],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

/** Consumer hook — must be used inside a ChatProvider. */
export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChatContext must be used within a <ChatProvider>");
  }
  return ctx;
}

export default ChatContext;
