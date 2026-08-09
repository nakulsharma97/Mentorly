import { useCallback, useEffect, useMemo, useState } from "react";
import client from "../../../api/client";
import { unwrap } from "../utils";

/**
 * Loads both booking-chat and direct-chat conversations, merges them into one
 * sorted list, and exposes client-side filters for inbox tabs and chips.
 */
export default function useConversations(profileId) {
  const [bookingConvs, setBookingConvs] = useState([]);
  const [directConvs, setDirectConvs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Refetch both conversation lists. Pass { silent: true } for background
   * refreshes (post-send, post-selection, incoming-message sync): the list
   * stays mounted and is NOT swapped for the loading skeleton, so the
   * sidebar never flashes while counts/previews update. The initial load
   * and explicit user-triggered refreshes stay visible.
   */
  const load = useCallback(async ({ silent } = {}) => {
    if (!profileId) {
      setBookingConvs([]);
      setDirectConvs([]);
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const [bookingRes, directRes] = await Promise.all([
        client
          .get("/api/v1/chat/conversations")
          .catch(() => ({ data: { data: [] } })),
        client
          .get("/api/v1/chat/direct/conversations")
          .catch(() => ({ data: { data: [] } })),
      ]);
      setBookingConvs(unwrap(bookingRes.data) || []);
      setDirectConvs(unwrap(directRes.data) || []);
    } catch {
      setError("Conversations could not be loaded.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [profileId]);

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
        title: c.participantName || c.sessionTitle || "SkillSwap Member",
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
        title: c.participantName || "SkillSwap Member",
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

    // A conversation represents a user PAIR, never a booked session. When the
    // same person appears in both a booking chat and a direct chat (or several
    // bookings), keep the most recently active row and fold in the other's
    // unread + session counts so nothing is lost and nothing duplicates.
    // `threads` records every underlying thread the row stands for so opening
    // the row can mark ALL of them read (a session-chat message must never
    // leave a permanent unread badge on the merged row).
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
        sessionCount: Math.max(
          existing.sessionCount || 0,
          row.sessionCount || 0,
        ),
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

  /** Apply a filter value + sort order to the merged list. */
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
          const status = String(
            c?.conversation?.bookingStatus || "",
          ).toUpperCase();
          return (
            c.kind === "booking" &&
            ["ACCEPTED", "CONFIRMED", "IN_PROGRESS"].includes(status)
          );
        });
      }

      if (String(sort || "").toLowerCase() === "oldest") {
        next = [...next].sort(
          (a, b) => new Date(a.time || 0) - new Date(b.time || 0),
        );
      }
      return next;
    },
    [conversations],
  );

  const patchDirect = useCallback((updater) => {
    setDirectConvs((prev) =>
      typeof updater === "function" ? updater(prev) : updater,
    );
  }, []);

  return {
    conversations,
    bookingConvs,
    directConvs,
    loading,
    error,
    load,
    filterConversations,
    patchDirect,
  };
}
