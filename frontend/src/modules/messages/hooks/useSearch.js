import { useEffect, useRef, useState } from "react";
import client from "../../../api/client";
import { unwrap } from "../utils";

const DEBOUNCE_MS = 300;

/**
 * Debounced backend search across booking + direct conversations.
 * Calls GET /api/v1/chat/search?q= after 300ms of inactivity and returns
 * the unified result rows. Empty query short-circuits to `null` (no search).
 */
export default function useSearch() {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null); // null = not searching
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const seqRef = useRef(0);

  const trimmed = term.trim();

  useEffect(() => {
    if (!trimmed) {
      setResults(null);
      setSearching(false);
      setSearchError(null);
      return undefined;
    }

    const seq = ++seqRef.current;
    setSearching(true);
    setSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const res = await client.get("/api/v1/chat/messages/search", {
          params: { q: trimmed },
        });
        if (seq !== seqRef.current) return;
        const data = unwrap(res.data);
        // Normalize the backend search rows to the exact same shape the
        // conversation list uses (prefixed id, convId, kind, title, …) so
        // selecting a search result opens the correct thread. Rows are then
        // deduped per person — one conversation per user pair, never one per
        // booked session.
        setResults(Array.isArray(data) ? dedupeRows(data.map(normalizeRow)) : []);
      } catch (err) {
        if (seq !== seqRef.current) return;
        setResults([]);
        setSearchError(
          err?.response?.data?.message || err?.message || "Search failed",
        );
      } finally {
        if (seq === seqRef.current) setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmed]);

  const clear = () => {
    seqRef.current += 1;
    setTerm("");
    setResults(null);
    setSearching(false);
    setSearchError(null);
  };

  return { term, setTerm, results, searching, searchError, clear };
}

/** Convert a backend unified-search row into a conversation-list row. */
function normalizeRow(r) {
  const kind = r?.kind === "booking" ? "booking" : "direct";
  const rawId = r?.id ?? r?.conversationId ?? r?.bookingId ?? "";
  return {
    id: kind === "booking" ? `booking-${rawId}` : `direct-${rawId}`,
    kind,
    convId: String(rawId),
    conversation: r,
    title:
      r?.participantName ||
      (kind === "booking" ? r?.sessionTitle : "SkillSwap Member") ||
      "SkillSwap Member",
    subtitle:
      r?.lastMessagePreview ||
      (kind === "booking" ? r?.sessionTitle : "") ||
      "",
    role: r?.participantRole || "",
    email: r?.participantEmail || "",
    time: r?.lastMessageAt || "",
    unreadCount: Number(r?.unreadCount || 0),
    online: Boolean(r?.participantOnline),
    presence: r?.participantPresenceText || "Offline",
    sessionTitle: r?.sessionTitle || "",
    sessionCount: Number(r?.sessionCount || 0),
    participantId: r?.participantId,
  };
}

/**
 * Collapse search results to ONE row per user pair (booking + direct rows for
 * the same person merge, keeping the most recent activity).
 */
function dedupeRows(rows) {
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
  return [...byParticipant.values()].sort(
    (a, b) => new Date(b.time || 0) - new Date(a.time || 0),
  );
}
