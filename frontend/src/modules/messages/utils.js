/**
 * Messaging module — shared formatting & grouping helpers.
 */

import { createElement } from "react";
import { normalizeSkills as sharedNormalizeSkills } from "../../utils/skills";

/**
 * Splits `text` into plain segments and highlighted <mark> matches for the
 * active search query. Returns a plain string when there is nothing to
 * highlight, otherwise an array of strings and mark elements.
 */
export function highlightMatch(text, query) {
  const value = String(text || "");
  const q = String(query || "").trim().toLowerCase();
  if (!q || !value) return value;
  const lower = value.toLowerCase();
  const out = [];
  let cursor = 0;
  let key = 0;
  while (cursor < value.length) {
    const idx = lower.indexOf(q, cursor);
    if (idx === -1) {
      out.push(value.slice(cursor));
      break;
    }
    if (idx > cursor) out.push(value.slice(cursor, idx));
    out.push(createElement("mark", { className: "ms-hl", key: `hl-${key++}` }, value.slice(idx, idx + q.length)));
    cursor = idx + q.length;
  }
  return out;
}

/** Friendly duration, e.g. 60 -> "1 hr", 45 -> "45 min", 90 -> "1 hr 30 min". */
export function formatDuration(minutes) {
  const mins = Number(minutes || 0);
  if (mins <= 0) return "—";
  if (mins % 60 === 0) return `${mins / 60} hr`;
  if (mins > 60) return `${Math.floor(mins / 60)} hr ${mins % 60} min`;
  return `${mins} min`;
}

export function formatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatConversationTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return formatMessageTime(value);
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function formatDayDivider(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const t = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  if (t === startToday) return "Today";
  if (t === startToday - 86400000) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

/**
 * Group a chronological message list into day buckets, and within each day
 * collapse consecutive same-sender messages into runs so the thread can render
 * a single avatar + timestamp per run (modern chat-app style).
 */
export function groupMessagesForThread(messages, currentUserId) {
  const days = [];
  let currentDay = null;
  let currentRun = null;
  (messages || []).forEach((msg) => {
    const dayLabel = formatDayDivider(msg.createdAt);
    if (!currentDay || currentDay.label !== dayLabel) {
      currentDay = { label: dayLabel, runs: [] };
      days.push(currentDay);
      currentRun = null;
    }
    const mine = String(msg?.senderId) === String(currentUserId);
    const runKey = mine ? "me" : `peer-${msg?.senderId ?? "?"}`;
    if (!currentRun || currentRun.runKey !== runKey) {
      currentRun = { runKey, mine, messages: [] };
      currentDay.runs.push(currentRun);
    }
    currentRun.messages.push(msg);
  });
  return days;
}

export function initialsOf(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function roleLabel(role) {
  const normalized = String(role || "").toUpperCase();
  if (normalized === "MENTOR") return "Mentor";
  if (normalized === "ADMIN") return "Admin";
  if (normalized === "LEARNER") return "Learner";
  return role ? String(role) : "Member";
}

/**
 * Normalize any raw skills value into a clean, deduplicated array of readable
 * skill names. Delegates to the canonical shared helper (utils/skills), which
 * parses JSON array strings (e.g. `[{"name":"Java","level":"Intermediate"}]`),
 * object arrays, nested arrays, and comma/;/|/newline CSV alike — so raw
 * backend values are NEVER rendered as-is.
 */
export function normalizeSkills(value) {
  return sharedNormalizeSkills(value);
}

/** Parse reactions JSON ("{\"👍\":[1,5]}") into a plain object. */
export function parseReactions(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** True when the content looks like an attachment message ("📎 name\nurl"). */
export function isAttachmentMessage(content) {
  return String(content || "").startsWith("📎 ") || String(content || "").startsWith("🎤 ");
}

export function splitAttachment(content) {
  const text = String(content || "");
  if (text.startsWith("📎 ")) {
    const lines = text.split("\n");
    return { type: "file", name: lines[0].replace("📎 ", "").trim(), url: lines.slice(1).join("\n").trim() };
  }
  if (text.startsWith("🎤 ")) {
    const lines = text.split("\n");
    return { type: "voice", name: "Voice message", url: lines.slice(1).join("\n").trim() };
  }
  return null;
}

/**
 * Human-friendly upcoming-session time, e.g. "Tomorrow · 7:00 PM" or
 * "Fri, Aug 7 · 9:30 AM". Returns "" for missing/invalid values.
 */
export function formatSessionTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const day = target === today ? "Today"
    : target === today + 86400000 ? "Tomorrow"
      : new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(date);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(date);
  return `${day} · ${time}`;
}

/** Friendly label for a booking status value. */
export function bookingStatusLabel(status) {
  const s = String(status || "").toUpperCase();
  const labels = {
    PENDING: "Pending",
    CONFIRMED: "Booked",
    APPROVED: "Booked",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REJECTED: "Rejected",
  };
  return labels[s] || s || "—";
}

/** Unwrap an ApiResponse payload: {message, data} -> data. */
export function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "message" in payload) {
    return payload.data;
  }
  return payload;
}
