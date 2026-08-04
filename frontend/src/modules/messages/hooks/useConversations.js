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

  const load = useCallback(async () => {
    if (!profileId) {
      setBookingConvs([]);
      setDirectConvs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
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
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  /** Merge both kinds into unified rows. */
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
      })),
    ];
    rows.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));
    return rows;
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
