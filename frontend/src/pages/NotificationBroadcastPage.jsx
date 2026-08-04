import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import SectionCard from "../modules/common/dashboard/SectionCard";
import TrendChart from "../modules/common/dashboard/TrendChart";
import "./AdminOperationsPage.css";
import "./NotificationBroadcastPage.css";
import "../modules/admin/ui/admin-ui.css";

/* ── Static config ─────────────────────────────────────────────── */

const NOTIFICATION_TYPES = [
  { value: "ANNOUNCEMENT", label: "Announcement", icon: "campaign", accent: "#0f766e" },
  { value: "MAINTENANCE", label: "Maintenance Notice", icon: "build", accent: "#b45309" },
  { value: "PLATFORM_UPDATE", label: "Platform Update", icon: "rocket_launch", accent: "#6d28d9" },
  { value: "SECURITY_ALERT", label: "Security Alert", icon: "gpp_maybe", accent: "#dc2626" },
  { value: "PAYMENT_NOTIFICATION", label: "Payment Notification", icon: "payments", accent: "#2563eb" },
  { value: "SESSION_REMINDER", label: "Session Reminder", icon: "schedule", accent: "#0891b2" },
  { value: "VERIFICATION_UPDATE", label: "Verification Update", icon: "verified", accent: "#059669" },
  { value: "REPORT_RESOLUTION", label: "Report Resolution", icon: "flag", accent: "#64748b" },
  { value: "WARNING", label: "Warning", icon: "warning", accent: "#d97706" },
  { value: "ACCOUNT_SUSPENSION", label: "Account Suspension", icon: "block", accent: "#b91c1c" },
  { value: "ACCOUNT_RESTORATION", label: "Account Restoration", icon: "restore", accent: "#16a34a" },
  { value: "CUSTOM", label: "Custom", icon: "stylus_note", accent: "#475569" },
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED", "FAILED", "ARCHIVED"];

const AUDIENCE_SCOPES = [
  { value: "ALL", label: "All users" },
  { value: "MENTORS", label: "All mentors" },
  { value: "LEARNERS", label: "All learners" },
  { value: "VERIFIED_MENTORS", label: "Verified mentors" },
  { value: "UNVERIFIED_MENTORS", label: "Unverified mentors" },
  { value: "SPECIFIC_USERS", label: "Specific users" },
  { value: "ROLES", label: "Selected roles" },
  { value: "SKILLS", label: "Users with a skill" },
  { value: "SESSION_PARTICIPANTS", label: "Session participants" },
  { value: "VERIFICATION_REQUESTS", label: "Verification requests" },
];

const REPEATS = [
  { value: "NONE", label: "No repeat" },
  { value: "DAILY", label: "Daily" },
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
];

const VERIFICATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"];

const ACTION_VERBS = { send: "sent", cancel: "cancelled", archive: "archived", duplicate: "duplicated" };

const emptyComposer = {
  title: "",
  subtitle: "",
  message: "",
  type: "ANNOUNCEMENT",
  priority: "MEDIUM",
  targetScope: "ALL",
  userIds: "",
  roles: [],
  skills: "",
  sessionIds: "",
  verificationStatuses: [],
  scheduleTime: "",
  expiresAt: "",
  repeatType: "NONE",
  actionButtonText: "",
  actionUrl: "",
};

/* ── Helpers ───────────────────────────────────────────────────── */

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.data?.error || err?.message || fallback;

const unwrap = (res) => res?.data?.data;

const formatNumber = (v) => Number(v || 0).toLocaleString();

const formatDateTime = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const formatDateOnly = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric" }).format(d);
};

const toLocalInput = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const toIso = (localValue) => (localValue ? new Date(localValue).toISOString() : null);

const scopeLabel = (scope) => AUDIENCE_SCOPES.find((s) => s.value === scope)?.label || scope || "All users";

const typeLabel = (type) => NOTIFICATION_TYPES.find((t) => t.value === type)?.label || type || "—";

const initials = (name) =>
  String(name || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* ── Animated counter ──────────────────────────────────────────── */
function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const from = prevRef.current;
    const to = Number(target) || 0;
    if (from === to) {
      setValue(to);
      return;
    }
    let raf;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setValue(current);
      if (t < 1) {
        raf = requestAnimationFrame(step);
      } else {
        prevRef.current = to;
      }
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      prevRef.current = to;
    };
  }, [target, duration]);
  return value;
}

function KpiCard({ label, value, icon }) {
  const animated = useCountUp(value);
  return (
    <div className="nbc-stat">
      <span className="nbc-stat__icon"><Icon name={icon} /></span>
      <div className="nbc-stat__body">
        <p className="nbc-stat__value">{formatNumber(Math.round(animated))}</p>
        <p className="nbc-stat__label">{label}</p>
      </div>
    </div>
  );
}

/* ── Ring progress (rates) ─────────────────────────────────────── */
function RateRing({ label, value, suffix = "%", color = "#0f766e" }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dash = (pct / 100) * circumference;
  return (
    <div className="nbc-rate-card">
      <div className="nbc-rate-card__ring">
        <svg viewBox="0 0 74 74" aria-label={`${label}: ${pct}${suffix}`}>
          <circle cx="37" cy="37" r={radius} fill="none" stroke="var(--admin-hover)" strokeWidth="7" />
          <circle
            cx="37"
            cy="37"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
        </svg>
        <span className="nbc-rate-card__ring-text">{Math.round(pct)}{suffix}</span>
      </div>
      <div className="nbc-rate-card__body">
        <strong>{label}</strong>
        <span>Real delivery analytics</span>
      </div>
    </div>
  );
}

/* ── Status / type / priority pills ────────────────────────────── */
function TypePill({ type }) {
  return <span className={`nbc-type-pill nbc-type-pill--${type || "CUSTOM"}`}>{typeLabel(type)}</span>;
}

function PriorityPill({ priority }) {
  return <span className={`nbc-priority-pill nbc-priority-pill--${priority || "MEDIUM"}`}>{priority || "MEDIUM"}</span>;
}

function StatusPill({ status }) {
  return <span className={`nbc-status-pill nbc-status-pill--${status || "DRAFT"}`}>{status || "DRAFT"}</span>;
}

/* ── Composer audience detail builder ──────────────────────────── */
function buildTargetDetail(form) {
  switch (form.targetScope) {
    case "SPECIFIC_USERS": {
      const ids = form.userIds.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
      return JSON.stringify({ userIds: ids });
    }
    case "ROLES":
      return JSON.stringify({ roles: form.roles });
    case "SKILLS": {
      const skills = form.skills.split(",").map((s) => s.trim()).filter(Boolean);
      return JSON.stringify({ skills });
    }
    case "SESSION_PARTICIPANTS": {
      const ids = form.sessionIds.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
      return JSON.stringify({ sessionIds: ids });
    }
    case "VERIFICATION_REQUESTS":
      return JSON.stringify({ verificationStatuses: form.verificationStatuses });
    default:
      return null;
  }
}

/* ════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════ */
export default function NotificationBroadcastPage({ notify }) {
  const [tab, setTab] = useState("dashboard"); // dashboard | compose | history | analytics

  // ── Dashboard data ──
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // ── History ──
  const [history, setHistory] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [filters, setFilters] = useState({
    type: "",
    priority: "",
    status: "",
    scope: "",
    q: "",
    fromDate: "",
    toDate: "",
  });
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const searchTimerRef = useRef(null);
  const historyReqRef = useRef(0);
  const lastErrorRef = useRef(null);

  // ── Detail drawer ──
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [recipients, setRecipients] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Analytics ──
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ── Composer ──
  const [composer, setComposer] = useState({ ...emptyComposer });
  const [sending, setSending] = useState(false);
  const [editId, setEditId] = useState(null);

  /* ── Single-toast helper ─────────────────────────────────────
     Deduplicates identical failures within a short window so a single
     failed request never spams toasts, but a genuinely new failure (or a
     retry that fails again later) still surfaces a toast. */
  const notifyOnce = useCallback((type, title, message) => {
    const key = `${title}|${message}`;
    const now = Date.now();
    const last = lastErrorRef.current;
    if (last && last.key === key && now - last.ts < 2500) return;
    lastErrorRef.current = { key, ts: now };
    notify?.({ type, title, message });
  }, [notify]);

  /* ── Dashboard ──────────────────────────────────────────────── */
  const loadDashboard = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await client.get("/api/v1/admin/notification-center/dashboard");
      setStats(unwrap(res) || {});
    } catch (err) {
      notifyOnce("error", "Dashboard unavailable", errorMessage(err, "Could not load notification dashboard."));
    } finally {
      setLoadingStats(false);
    }
  }, [notifyOnce]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* ── History ────────────────────────────────────────────────── */
  const loadHistory = useCallback(async (pageNum = 0) => {
    const reqId = ++historyReqRef.current;
    setLoadingHistory(true);
    try {
      const params = { page: pageNum, size: pageSize };
      if (filters.type) params.type = filters.type;
      if (filters.priority) params.priority = filters.priority;
      if (filters.status) params.status = filters.status;
      if (filters.scope) params.scope = filters.scope;
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      const res = await client.get("/api/v1/admin/notification-center", { params });
      if (reqId !== historyReqRef.current) return; // stale response guard
      setHistory(unwrap(res) || null);
      setPage(pageNum);
    } catch (err) {
      if (reqId !== historyReqRef.current) return;
      notifyOnce("error", "History unavailable", errorMessage(err, "Could not load broadcast history."));
    } finally {
      if (reqId === historyReqRef.current) setLoadingHistory(false);
    }
  }, [filters, notifyOnce]);

  // Debounced search — fires on mount too, so it also covers the initial load.
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadHistory(0);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, loadHistory]);

  /* ── Analytics ──────────────────────────────────────────────── */
  const loadAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const res = await client.get("/api/v1/admin/notification-center/analytics?months=6");
      setAnalytics(unwrap(res) || null);
    } catch (err) {
      notifyOnce("error", "Analytics unavailable", errorMessage(err, "Could not load notification analytics."));
    } finally {
      setLoadingAnalytics(false);
    }
  }, [notifyOnce]);

  // Load analytics lazily the first time the Analytics tab is opened.
  useEffect(() => {
    if (tab === "analytics" && !analytics && !loadingAnalytics) {
      loadAnalytics();
    }
  }, [tab, analytics, loadingAnalytics, loadAnalytics]);

  /* ── Detail drawer ──────────────────────────────────────────── */
  const openDetail = useCallback(async (id) => {
    setSelected(id);
    setDetail(null);
    setRecipients(null);
    setLoadingDetail(true);
    try {
      const [detailRes, recRes] = await Promise.all([
        client.get(`/api/v1/admin/notification-center/${id}`),
        client.get(`/api/v1/admin/notification-center/${id}/recipients?page=0&size=8`),
      ]);
      setDetail(unwrap(detailRes) || null);
      setRecipients(unwrap(recRes) || null);
    } catch (err) {
      notifyOnce("error", "Details unavailable", errorMessage(err, "Could not load broadcast details."));
    } finally {
      setLoadingDetail(false);
    }
  }, [notifyOnce]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setDetail(null);
    setRecipients(null);
  }, []);

  /* ── Actions ────────────────────────────────────────────────── */
  const confirmAction = (title, message) =>
    window.confirm(`${title}\n\n${message}`);

  const runAction = useCallback(async (id, action, successMsg, successNotify = true) => {
    try {
      const res = await client.post(`/api/v1/admin/notification-center/${id}/${action}`);
      if (successNotify) {
        const data = unwrap(res) || {};
        notify?.({
          type: "success",
          title: successMsg,
          message: `Broadcast #${id} ${ACTION_VERBS[action] ?? action.replaceAll("-", " ")}.`,
        });
        if (data.id) return data;
      }
      return unwrap(res);
    } catch (err) {
      notifyOnce("error", `${successMsg} failed`, errorMessage(err, `Could not ${action.replaceAll("-", " ")} the broadcast.`));
      return null;
    }
  }, [notify, notifyOnce]);

  const handleSendNow = async (id) => {
    if (!confirmAction("Send now", "This will deliver the broadcast to its audience immediately. Continue?")) return;
    const data = await runAction(id, "send", "Broadcast sent");
    if (data) {
      closeDetail();
      loadHistory(page);
      loadDashboard();
    }
  };

  const handleCancel = async (id) => {
    if (!confirmAction("Cancel scheduled broadcast", "The scheduled delivery will be cancelled and will never fire.")) return;
    const data = await runAction(id, "cancel", "Broadcast cancelled");
    if (data) {
      closeDetail();
      loadHistory(page);
      loadDashboard();
    }
  };

  const handleDuplicate = async (id) => {
    const data = await runAction(id, "duplicate", "Broadcast duplicated", false);
    if (data) {
      notify?.({ type: "success", title: "Draft created", message: `New draft #${data.id} opened in the composer.` });
      let detail = {};
      try {
        detail = data.targetDetail ? JSON.parse(data.targetDetail) : {};
      } catch {
        detail = {};
      }
      setComposer({
        title: data.title?.replace(/\s*\(copy\)\s*$/, "") || "",
        subtitle: data.subtitle || "",
        message: data.message || "",
        type: data.type || "ANNOUNCEMENT",
        priority: data.priority || "MEDIUM",
        targetScope: data.targetScope || "ALL",
        userIds: Array.isArray(detail.userIds) ? detail.userIds.join(", ") : "",
        roles: Array.isArray(detail.roles) ? detail.roles : [],
        skills: Array.isArray(detail.skills) ? detail.skills.join(", ") : "",
        sessionIds: Array.isArray(detail.sessionIds) ? detail.sessionIds.join(", ") : "",
        verificationStatuses: Array.isArray(detail.verificationStatuses) ? detail.verificationStatuses : [],
        scheduleTime: "",
        expiresAt: data.expiresAt ? toLocalInput(data.expiresAt) : "",
        repeatType: data.repeatType || "NONE",
        actionButtonText: data.actionButtonText || "",
        actionUrl: data.actionUrl || "",
      });
      setEditId(data.id);
      setTab("compose");
      loadHistory(page);
    }
  };

  const handleArchive = async (id) => {
    if (!confirmAction("Archive broadcast", "The broadcast leaves the active history but stays stored for audit.")) return;
    const data = await runAction(id, "archive", "Broadcast archived");
    if (data) {
      closeDetail();
      loadHistory(page);
      loadDashboard();
    }
  };

  const handleDelete = async (id) => {
    if (!confirmAction("Delete broadcast", "This permanently removes the broadcast from history. Recipients keep their notifications.")) return;
    try {
      await client.delete(`/api/v1/admin/notification-center/${id}`);
      notify?.({ type: "success", title: "Broadcast deleted", message: `Broadcast #${id} deleted.` });
      closeDetail();
      loadHistory(page);
      loadDashboard();
    } catch (err) {
      notifyOnce("error", "Delete failed", errorMessage(err, "Could not delete the broadcast."));
    }
  };

  const handleResend = async (id) => {
    if (!confirmAction("Resend to unread", "The broadcast will be re-sent to everyone who has not read it yet.")) return;
    // successNotify=false: the custom toast below is the single success toast.
    const res = await runAction(id, "resend", "Broadcast resent", false);
    if (res) {
      notify?.({ type: "success", title: "Resent", message: `${res.resent ?? 0} unread recipients got the broadcast again.` });
      loadHistory(page);
      loadDashboard();
    }
  };

  /* ── Composer ───────────────────────────────────────────────── */
  const openComposer = useCallback(() => {
    setComposer({ ...emptyComposer });
    setEditId(null);
    setTab("compose");
  }, []);

  const openEdit = useCallback((row) => {
    let detail = {};
    try {
      detail = row.targetDetail ? JSON.parse(row.targetDetail) : {};
    } catch {
      detail = {};
    }
    setComposer({
      title: row.title || "",
      subtitle: row.subtitle || "",
      message: row.message || "",
      type: row.type || "ANNOUNCEMENT",
      priority: row.priority || "MEDIUM",
      targetScope: row.targetScope || "ALL",
      userIds: Array.isArray(detail.userIds) ? detail.userIds.join(", ") : "",
      roles: Array.isArray(detail.roles) ? detail.roles : [],
      skills: Array.isArray(detail.skills) ? detail.skills.join(", ") : "",
      sessionIds: Array.isArray(detail.sessionIds) ? detail.sessionIds.join(", ") : "",
      verificationStatuses: Array.isArray(detail.verificationStatuses) ? detail.verificationStatuses : [],
      scheduleTime: row.scheduleTime ? toLocalInput(row.scheduleTime) : "",
      expiresAt: row.expiresAt ? toLocalInput(row.expiresAt) : "",
      repeatType: row.repeatType || "NONE",
      actionButtonText: row.actionButtonText || "",
      actionUrl: row.actionUrl || "",
    });
    setEditId(row.id);
    setTab("compose");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const setField = (key, value) => setComposer((prev) => ({ ...prev, [key]: value }));

  const toggleInList = (key, value) => {
    setComposer((prev) => {
      const current = prev[key] || [];
      return {
        ...prev,
        [key]: current.includes(value) ? current.filter((v) => v !== value) : [...current, value],
      };
    });
  };

  const handleSubmitComposer = async (e) => {
    e.preventDefault();
    if (!composer.title.trim() || !composer.message.trim()) {
      notifyOnce("error", "Validation", "Title and message are required.");
      return;
    }
    if (composer.targetScope === "SPECIFIC_USERS" && !composer.userIds.trim()) {
      notifyOnce("error", "Validation", "Enter at least one user ID for the Specific users audience.");
      return;
    }
    if (composer.targetScope === "ROLES" && composer.roles.length === 0) {
      notifyOnce("error", "Validation", "Select at least one role for the audience.");
      return;
    }
    if (composer.targetScope === "SKILLS" && !composer.skills.trim()) {
      notifyOnce("error", "Validation", "Enter at least one skill for the audience.");
      return;
    }
    if (composer.targetScope === "SESSION_PARTICIPANTS" && !composer.sessionIds.trim()) {
      notifyOnce("error", "Validation", "Enter at least one session ID for the audience.");
      return;
    }
    if (composer.targetScope === "VERIFICATION_REQUESTS" && composer.verificationStatuses.length === 0) {
      notifyOnce("error", "Validation", "Select at least one verification status for the audience.");
      return;
    }

    setSending(true);
    const payload = {
      title: composer.title.trim(),
      subtitle: composer.subtitle.trim() || null,
      message: composer.message.trim(),
      type: composer.type,
      priority: composer.priority,
      targetScope: composer.targetScope,
      targetDetail: buildTargetDetail(composer),
      scheduleTime: toIso(composer.scheduleTime),
      expiresAt: toIso(composer.expiresAt),
      repeatType: composer.repeatType,
      actionButtonText: composer.actionButtonText.trim() || null,
      actionUrl: composer.actionUrl.trim() || null,
      sendNow: !composer.scheduleTime,
    };

    try {
      if (editId) {
        await client.patch(`/api/v1/admin/notification-center/${editId}`, payload);
        notify?.({ type: "success", title: "Broadcast updated", message: `Broadcast #${editId} saved.` });
      } else {
        const res = await client.post("/api/v1/admin/notification-center", payload);
        const created = unwrap(res) || {};
        notify?.({
          type: "success",
          title: created.scheduleTime ? "Broadcast scheduled" : "Broadcast sent",
          message: created.scheduleTime
            ? `Scheduled for ${formatDateTime(created.scheduleTime)}.`
            : "Broadcast delivered through the notification pipeline.",
        });
      }
      setComposer({ ...emptyComposer });
      setEditId(null);
      loadDashboard();
      loadHistory(0);
      setTab("history");
    } catch (err) {
      notifyOnce("error", editId ? "Update failed" : "Broadcast failed",
        errorMessage(err, editId ? "Could not update the broadcast." : "Could not create the broadcast."));
    } finally {
      setSending(false);
    }
  };

  /* ── Derived render helpers ─────────────────────────────────── */
  const historyRows = history?.content || [];
  const totalPages = Math.max(0, (history?.totalPages) || 0);

  const audienceDetailLabel = useMemo(() => {
    if (!composer.targetScope) return "";
    switch (composer.targetScope) {
      case "SPECIFIC_USERS":
        return composer.userIds ? `Users: ${composer.userIds}` : "No users selected";
      case "ROLES":
        return composer.roles.length ? composer.roles.join(", ") : "No roles selected";
      case "SKILLS":
        return composer.skills ? `Skill: ${composer.skills}` : "No skill entered";
      case "SESSION_PARTICIPANTS":
        return composer.sessionIds ? `Sessions: ${composer.sessionIds}` : "No sessions entered";
      case "VERIFICATION_REQUESTS":
        return composer.verificationStatuses.length
          ? composer.verificationStatuses.join(", ") : "No statuses selected";
      default:
        return scopeLabel(composer.targetScope);
    }
  }, [composer]);

  /* ════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════ */
  return (
    <section className="admin-page">
      {/* ── Hero ── */}
      <div className="admin-hero">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p className="admin-eyebrow">Engagement</p>
            <h1>Notification &amp; Broadcast Center</h1>
            <p>Compose, schedule, and track platform-wide notifications. All stats come from real database records.</p>
          </div>
          <button type="button" className="admin-refresh-btn" onClick={openComposer} style={{ padding: "10px 18px" }}>
            <Icon name="add_circle" /> New broadcast
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="nbc-tabs">
        {[
          { key: "dashboard", label: "Dashboard", icon: "space_dashboard" },
          { key: "compose", label: "Compose", icon: "edit_note" },
          { key: "history", label: "History", icon: "history" },
          { key: "analytics", label: "Analytics", icon: "monitoring" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`nbc-tab${tab === t.key ? " nbc-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ DASHBOARD TAB ════════════════ */}
      {tab === "dashboard" && (
        <>
          {loadingStats && !stats ? (
            <div className="nbc-kpi-grid">
              {Array.from({ length: 12 }).map((_, i) => <div key={i} className="nbc-skeleton-card" />)}
            </div>
          ) : (
            <>
              <div className="nbc-kpi-grid">
                <KpiCard label="Total broadcasts" value={stats?.totalBroadcasts} icon="campaign" />
                <KpiCard label="Sent" value={stats?.sent} icon="send" />
                <KpiCard label="Scheduled" value={stats?.scheduled} icon="schedule" />
                <KpiCard label="Drafts" value={stats?.drafts} icon="draft" />
                <KpiCard label="Cancelled" value={stats?.cancelled} icon="cancel" />
                <KpiCard label="Failed broadcasts" value={stats?.failedBroadcasts} icon="error" />
                <KpiCard label="Total notifications" value={stats?.totalNotifications} icon="notifications" />
                <KpiCard label="Unread" value={stats?.unread} icon="mark_email_unread" />
                <KpiCard label="Read" value={stats?.read} icon="mark_email_read" />
                <KpiCard label="Sent today" value={stats?.sentToday} icon="today" />
                <KpiCard label="Failed deliveries" value={stats?.failedDeliveries} icon="warning" />
                <KpiCard label="Success rate" value={stats?.successRate} icon="verified" />
              </div>

              <div className="aa-grid">
                <SectionCard title="Broadcast types" icon="category" headerExtra={
                  <span className="admin-count-badge">{formatNumber(stats?.totalBroadcasts)} campaigns</span>
                }>
                  <ul className="nbc-most-opened">
                    <li>
                      <span className="nbc-most-opened__title">Announcements</span>
                      <span className="nbc-most-opened__count">{formatNumber(stats?.announcements)}</span>
                    </li>
                    <li>
                      <span className="nbc-most-opened__title">Maintenance notices</span>
                      <span className="nbc-most-opened__count">{formatNumber(stats?.maintenance)}</span>
                    </li>
                    <li>
                      <span className="nbc-most-opened__title">Platform updates</span>
                      <span className="nbc-most-opened__count">{formatNumber(stats?.platformUpdates)}</span>
                    </li>
                  </ul>
                </SectionCard>

                <SectionCard title="Delivery success rate" icon="fact_check" headerExtra={
                  <span className="admin-count-badge">{stats?.successRate ?? 0}%</span>
                }>
                  <div style={{ paddingTop: 8 }}>
                    <div className="nbc-progress" style={{ marginBottom: 14 }}>
                      <span>Delivered</span>
                      <div className="nbc-progress__bar">
                        <div className="nbc-progress__fill" style={{ width: `${stats?.successRate ?? 0}%` }} />
                      </div>
                      <span>{stats?.successRate ?? 0}%</span>
                    </div>
                    <div className="nbc-progress" style={{ marginBottom: 14 }}>
                      <span>Failed</span>
                      <div className="nbc-progress__bar">
                        <div className="nbc-progress__fill nbc-progress__fill--failed"
                          style={{ width: `${Math.min(100, 100 - (stats?.successRate ?? 100))}%` }} />
                      </div>
                      <span>{formatNumber(stats?.failedDeliveries)}</span>
                    </div>
                    <div className="nbc-progress">
                      <span>Unread</span>
                      <div className="nbc-progress__bar">
                        <div className="nbc-progress__fill nbc-progress__fill--read"
                          style={{ width: `${stats?.totalNotifications ? Math.round((stats.unread / stats.totalNotifications) * 100) : 0}%` }} />
                      </div>
                      <span>{formatNumber(stats?.unread)}</span>
                    </div>
                  </div>
                </SectionCard>
              </div>

              <div className="admin-panel">
                <div className="admin-section-heading">
                  <div>
                    <p className="admin-eyebrow">Quick actions</p>
                    <h2>Notification Center</h2>
                  </div>
                </div>
                <p className="admin-text-muted" style={{ marginBottom: 16 }}>
                  Broadcasts are delivered as in-app notifications via the existing pipeline (database + WebSocket push),
                  so recipients see them in real time. Scheduled broadcasts are picked up automatically by the scheduler.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="admin-refresh-btn" onClick={openComposer}>
                    <Icon name="add_circle" /> Compose broadcast
                  </button>
                  <button type="button" className="admin-refresh-btn" onClick={() => { setTab("history"); loadHistory(0); }} style={{ background: "#334155" }}>
                    <Icon name="history" /> View history
                  </button>
                  <button type="button" className="admin-refresh-btn" onClick={() => { setTab("analytics"); loadAnalytics(); }} style={{ background: "#6d28d9" }}>
                    <Icon name="monitoring" /> View analytics
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════ COMPOSE TAB ════════════════ */}
      {tab === "compose" && (
        <div className="nbc-composer">
          <div className="admin-panel" style={{ marginTop: 0 }}>
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">{editId ? "Edit broadcast" : "New broadcast"}</p>
                <h2>{editId ? `Editing #${editId}` : "Compose notification"}</h2>
              </div>
              {editId && (
                <button type="button" className="admin-action-btn admin-action-cancel" onClick={() => { setEditId(null); setComposer({ ...emptyComposer }); }}>
                  Cancel edit
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitComposer} className="nbc-composer__form">
              <div className="nbc-field">
                <label htmlFor="nbc-title">Title *</label>
                <input id="nbc-title" type="text" value={composer.title}
                  onChange={(e) => setField("title", e.target.value)}
                  placeholder="e.g., Platform maintenance tonight" maxLength={255} />
              </div>

              <div className="nbc-field">
                <label htmlFor="nbc-subtitle">Subtitle</label>
                <input id="nbc-subtitle" type="text" value={composer.subtitle}
                  onChange={(e) => setField("subtitle", e.target.value)}
                  placeholder="Short supporting line shown under the title" maxLength={500} />
              </div>

              <div className="nbc-field">
                <label htmlFor="nbc-message">Message *</label>
                <textarea id="nbc-message" value={composer.message}
                  onChange={(e) => setField("message", e.target.value)}
                  placeholder="Write your message. Plain text is rendered as-is in the notification center." rows={5} />
              </div>

              <div className="nbc-field">
                <label>Notification type</label>
                <div className="nbc-type-grid">
                  {NOTIFICATION_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      className={`nbc-type-option${composer.type === t.value ? " is-active" : ""}`}
                      onClick={() => setField("type", t.value)}
                    >
                      <Icon name={t.icon} /> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="nbc-form-row">
                <div className="nbc-field">
                  <label htmlFor="nbc-priority">Priority</label>
                  <select id="nbc-priority" value={composer.priority}
                    onChange={(e) => setField("priority", e.target.value)}>
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="nbc-field">
                  <label htmlFor="nbc-repeat">Repeat</label>
                  <select id="nbc-repeat" value={composer.repeatType}
                    onChange={(e) => setField("repeatType", e.target.value)}>
                    {REPEATS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="nbc-field">
                <label htmlFor="nbc-scope">Target audience</label>
                <select id="nbc-scope" value={composer.targetScope}
                  onChange={(e) => setField("targetScope", e.target.value)}>
                  {AUDIENCE_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <p className="nbc-field-hint">Target: <strong>{audienceDetailLabel}</strong></p>
              </div>

              {composer.targetScope === "SPECIFIC_USERS" && (
                <div className="nbc-field">
                  <label htmlFor="nbc-userIds">User IDs (comma-separated)</label>
                  <input id="nbc-userIds" type="text" value={composer.userIds}
                    onChange={(e) => setField("userIds", e.target.value)}
                    placeholder="e.g., 12, 45, 88" />
                </div>
              )}

              {composer.targetScope === "ROLES" && (
                <div className="nbc-field">
                  <label>Roles</label>
                  <div className="nbc-type-grid">
                    {["LEARNER", "MENTOR", "ADMIN"].map((r) => (
                      <button key={r} type="button"
                        className={`nbc-type-option${(composer.roles || []).includes(r) ? " is-active" : ""}`}
                        onClick={() => toggleInList("roles", r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {composer.targetScope === "SKILLS" && (
                <div className="nbc-field">
                  <label htmlFor="nbc-skills">Skills (comma-separated)</label>
                  <input id="nbc-skills" type="text" value={composer.skills}
                    onChange={(e) => setField("skills", e.target.value)}
                    placeholder="e.g., Java, Public Speaking" />
                </div>
              )}

              {composer.targetScope === "SESSION_PARTICIPANTS" && (
                <div className="nbc-field">
                  <label htmlFor="nbc-sessionIds">Session IDs (comma-separated)</label>
                  <input id="nbc-sessionIds" type="text" value={composer.sessionIds}
                    onChange={(e) => setField("sessionIds", e.target.value)}
                    placeholder="e.g., 101, 102" />
                </div>
              )}

              {composer.targetScope === "VERIFICATION_REQUESTS" && (
                <div className="nbc-field">
                  <label>Verification statuses</label>
                  <div className="nbc-type-grid">
                    {VERIFICATION_STATUSES.map((s) => (
                      <button key={s} type="button"
                        className={`nbc-type-option${(composer.verificationStatuses || []).includes(s) ? " is-active" : ""}`}
                        onClick={() => toggleInList("verificationStatuses", s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="nbc-form-row--3">
                <div className="nbc-field">
                  <label htmlFor="nbc-schedule">Schedule time</label>
                  <input id="nbc-schedule" type="datetime-local" value={composer.scheduleTime}
                    onChange={(e) => setField("scheduleTime", e.target.value)} />
                  <p className="nbc-field-hint">Leave empty to send immediately.</p>
                </div>
                <div className="nbc-field">
                  <label htmlFor="nbc-expires">Expires at</label>
                  <input id="nbc-expires" type="datetime-local" value={composer.expiresAt}
                    onChange={(e) => setField("expiresAt", e.target.value)} />
                  <p className="nbc-field-hint">Optional — repeating broadcasts stop after this.</p>
                </div>
                <div className="nbc-field">
                  <label>&nbsp;</label>
                  <div className="nbc-checkbox-row" style={{ padding: "8px 10px" }}>
                    <label>
                      <input type="checkbox"
                        checked={composer.actionButtonText?.trim().length > 0 || composer.actionUrl?.trim().length > 0}
                        onChange={(e) => {
                          if (!e.target.checked) {
                            setField("actionButtonText", "");
                            setField("actionUrl", "");
                          }
                        }} />
                      Add action button
                    </label>
                  </div>
                </div>
              </div>

              {(composer.actionButtonText?.trim() || composer.actionUrl?.trim()) && (
                <div className="nbc-form-row">
                  <div className="nbc-field">
                    <label htmlFor="nbc-actionText">Action button text</label>
                    <input id="nbc-actionText" type="text" value={composer.actionButtonText}
                      onChange={(e) => setField("actionButtonText", e.target.value)}
                      placeholder="e.g., View details" maxLength={100} />
                  </div>
                  <div className="nbc-field">
                    <label htmlFor="nbc-actionUrl">Action URL</label>
                    <input id="nbc-actionUrl" type="url" value={composer.actionUrl}
                      onChange={(e) => setField("actionUrl", e.target.value)}
                      placeholder="https://skillswap.com/..." />
                  </div>
                </div>
              )}

              <div className="nbc-composer__actions">
                <button type="submit" className="admin-refresh-btn" disabled={sending} style={{ padding: "10px 22px" }}>
                  <Icon name="send" /> {sending ? "Working…" : (editId ? "Save changes" : (composer.scheduleTime ? "Schedule" : "Send now"))}
                </button>
                <button type="button" className="admin-action-btn admin-action-cancel"
                  onClick={() => { setComposer({ ...emptyComposer }); setEditId(null); }}>
                  Clear
                </button>
              </div>
            </form>
          </div>

          {/* Live preview */}
          <div className="admin-panel" style={{ marginTop: 0 }}>
            <div className="admin-section-heading">
              <div>
                <p className="admin-eyebrow">Live preview</p>
                <h2>How recipients see it</h2>
              </div>
            </div>
            <div className="nbc-preview">
              <div className="nbc-preview__phone">
                <div className="nbc-preview__card">
                  <div className="nbc-preview__head">
                    <span className="nbc-preview__avatar"><Icon name="notifications" /></span>
                    <div>
                      <div className="nbc-preview__app">SkillSwap</div>
                      <div className="nbc-preview__now">Just now</div>
                    </div>
                  </div>
                  <div className="nbc-preview__body">
                    <div className="nbc-preview__type">
                      <TypePill type={composer.type} /> <PriorityPill priority={composer.priority} />
                    </div>
                    <h3 className="nbc-preview__title">{composer.title || "Notification title"}</h3>
                    {composer.subtitle && <p style={{ color: "var(--admin-muted)", fontSize: "0.8rem", margin: "0 0 6px" }}>{composer.subtitle}</p>}
                    <p className="nbc-preview__message">{composer.message || "Your message will appear here."}</p>
                    {composer.actionButtonText && (
                      <span className="nbc-preview__action">{composer.actionButtonText}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="nbc-preview__meta">
                <span className="admin-count-badge">{scopeLabel(composer.targetScope)}</span>
                {composer.repeatType !== "NONE" && (
                  <span className="admin-count-badge">Repeats {composer.repeatType.toLowerCase()}</span>
                )}
                {composer.scheduleTime && (
                  <span className="admin-count-badge">Scheduled {formatDateTime(composer.scheduleTime)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ HISTORY TAB ════════════════ */}
      {tab === "history" && (
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">History</p>
              <h2>Broadcast history</h2>
            </div>
            <button type="button" className="admin-refresh-btn" onClick={() => loadHistory(page)}>
              <Icon name="refresh" /> Refresh
            </button>
          </div>

          {/* Filters */}
          <div className="nbc-filters">
            <div className="admin-search">
              <Icon name="search" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="Search by title, subtitle, or message…"
                aria-label="Search broadcasts"
              />
            </div>
            <select value={filters.type} onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value }))} aria-label="Filter by type">
              <option value="">All types</option>
              {NOTIFICATION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select value={filters.priority} onChange={(e) => setFilters((prev) => ({ ...prev, priority: e.target.value }))} aria-label="Filter by priority">
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} aria-label="Filter by status">
              <option value="">All statuses</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.scope} onChange={(e) => setFilters((prev) => ({ ...prev, scope: e.target.value }))} aria-label="Filter by audience">
              <option value="">All audiences</option>
              {AUDIENCE_SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value }))} aria-label="From date" />
            <input type="date" value={filters.toDate} onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value }))} aria-label="To date" />
            <button type="button" className="admin-action-btn admin-action-cancel"
              onClick={() => setFilters({ type: "", priority: "", status: "", scope: "", q: "", fromDate: "", toDate: "" })}>
              Reset
            </button>
          </div>

          {/* Table */}
          {loadingHistory && !history ? (
            <div className="nbc-skeleton-table">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="nbc-skeleton-row" />)}
            </div>
          ) : historyRows.length === 0 ? (
            <div className="admin-empty-state">
              <span className="material-symbols-outlined">notifications_off</span>
              <h3 style={{ margin: "4px 0 0", color: "var(--admin-text)" }}>No broadcasts found</h3>
              <p style={{ maxWidth: "38ch", margin: "6px 0 0" }}>
                {filters.q || filters.type || filters.status || filters.priority
                  ? "No broadcasts match your filters. Try clearing some."
                  : "You haven't sent any broadcasts yet. Compose one to reach your users."}
              </p>
              {!filters.q && !filters.type && !filters.status && !filters.priority && (
                <button type="button" className="admin-refresh-btn" onClick={openComposer} style={{ marginTop: 8 }}>
                  <Icon name="add_circle" /> Compose your first broadcast
                </button>
              )}
            </div>
          ) : (
            <div className="nbc-table-wrap">
              <table className="nbc-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Audience</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Delivery</th>
                    <th>Created by</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.id}>
                      <td className="nbc-cell-num">#{row.id}</td>
                      <td>
                        <div className="nbc-table-title" title={row.title}>{row.title}</div>
                        {row.subtitle && <div className="nbc-table-sub">{row.subtitle}</div>}
                      </td>
                      <td><TypePill type={row.type} /></td>
                      <td>
                        <span className="admin-count-badge">{scopeLabel(row.targetScope)}</span>
                        {row.repeatType && row.repeatType !== "NONE" && (
                          <div className="nbc-table-sub">{row.repeatType.toLowerCase()} repeat</div>
                        )}
                      </td>
                      <td><PriorityPill priority={row.priority} /></td>
                      <td><StatusPill status={row.status} /></td>
                      <td>
                        <span className="nbc-cell-num">{formatNumber(row.delivered)}</span>
                        <span className="admin-text-muted" style={{ fontSize: "0.78rem" }}> / {formatNumber(row.read)} read</span>
                        <div className="nbc-progress" style={{ marginTop: 4, minWidth: 110 }}>
                          <div className="nbc-progress__bar">
                            <div className="nbc-progress__fill"
                              style={{ width: `${row.delivered ? Math.round((row.read / row.delivered) * 100) : 0}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{row.createdByName || "Unknown"}</td>
                      <td className="nbc-cell-num" title={formatDateTime(row.createdAt)}>{formatDateOnly(row.createdAt)}</td>
                      <td>
                        <div className="nbc-row-actions">
                          <button type="button" className="nbc-icon-btn" title="View details" onClick={() => openDetail(row.id)}>
                            <Icon name="visibility" />
                          </button>
                          {(row.status === "DRAFT" || row.status === "SCHEDULED") && (
                            <>
                              <button type="button" className="nbc-icon-btn" title="Edit" onClick={() => openEdit(row)}>
                                <Icon name="edit" />
                              </button>
                              {row.status === "SCHEDULED" && (
                                <button type="button" className="nbc-icon-btn" title="Send now" onClick={() => handleSendNow(row.id)}>
                                  <Icon name="send" />
                                </button>
                              )}
                              {row.status === "SCHEDULED" && (
                                <button type="button" className="nbc-icon-btn" title="Cancel scheduled" onClick={() => handleCancel(row.id)}>
                                  <Icon name="block" />
                                </button>
                              )}
                            </>
                          )}
                          <button type="button" className="nbc-icon-btn" title="Duplicate" onClick={() => handleDuplicate(row.id)}>
                            <Icon name="content_copy" />
                          </button>
                          {(row.status === "SENT" || row.status === "FAILED") && (
                            <button type="button" className="nbc-icon-btn" title="Resend to unread" onClick={() => handleResend(row.id)}>
                              <Icon name="replay" />
                            </button>
                          )}
                          <button type="button" className="nbc-icon-btn" title="Archive" onClick={() => handleArchive(row.id)}>
                            <Icon name="archive" />
                          </button>
                          <button type="button" className="nbc-icon-btn nbc-icon-btn--danger" title="Delete" onClick={() => handleDelete(row.id)}>
                            <Icon name="delete" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {history && historyRows.length > 0 && (
            <div className="nbc-pagination">
              <span className="nbc-pagination__info">
                Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, history.totalElements || 0)} of {formatNumber(history.totalElements || 0)}
              </span>
              <div className="nbc-pagination__btns">
                <button type="button" className="nbc-page-btn" disabled={page <= 0} onClick={() => loadHistory(page - 1)}>
                  ← Prev
                </button>
                <button type="button" className="nbc-page-btn" disabled={page >= totalPages - 1} onClick={() => loadHistory(page + 1)}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ ANALYTICS TAB ════════════════ */}
      {tab === "analytics" && (
        <>
          {loadingAnalytics && !analytics ? (
            <div className="nbc-kpi-grid">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="nbc-skeleton-card" />)}
            </div>
          ) : (
            <>
              <div className="nbc-kpi-grid">
                <KpiCard label="Delivered" value={analytics?.delivered} icon="send" />
                <KpiCard label="Read" value={analytics?.read} icon="mark_email_read" />
                <KpiCard label="Clicked actions" value={analytics?.clicked} icon="ads_click" />
                <KpiCard label="Failed deliveries" value={analytics?.failed} icon="error" />
              </div>

              <div className="nbc-analytics-grid">
                <RateRing label="Read rate" value={analytics?.readRate} color="#0f766e" />
                <RateRing label="Click rate" value={analytics?.clickRate} color="#8b5cf6" />
                <RateRing label="Delivery success" value={analytics?.deliverySuccess} color="#16a34a" />
              </div>

              <div className="aa-grid">
                <SectionCard title="Broadcasts per month" icon="bar_chart">
                  {analytics?.monthly?.length > 0 ? (
                    <TrendChart data={analytics.monthly} type="bar" height={180} valueFormatter={(v) => `${v} broadcasts`} />
                  ) : (
                    <div className="admin-empty-state"><Icon name="bar_chart" /><p>No broadcast data yet.</p></div>
                  )}
                </SectionCard>
                <SectionCard title="Notifications per day (30 days)" icon="calendar_month">
                  {analytics?.daily?.length > 0 && analytics.daily.some((b) => b?.value > 0) ? (
                    <TrendChart data={analytics.daily} type="area" height={180} gradientId="nbcDaily" valueFormatter={(v) => `${v} sent`} />
                  ) : (
                    <div className="admin-empty-state"><Icon name="calendar_month" /><p>No notifications sent in this window.</p></div>
                  )}
                </SectionCard>
              </div>

              <div className="aa-grid">
                <SectionCard title="Most opened broadcasts" icon="leaderboard" headerExtra={
                  <span className="admin-count-badge">{analytics?.mostOpened?.length || 0} campaigns</span>
                }>
                  {analytics?.mostOpened?.length > 0 ? (
                    <ul className="nbc-most-opened">
                      {analytics.mostOpened.map((b) => (
                        <li key={b.id}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div className="nbc-most-opened__title">{b.title}</div>
                            <div className="nbc-table-sub"><TypePill type={b.type} /> · {formatDateOnly(b.sentAt)}</div>
                          </div>
                          <span className="nbc-most-opened__count">{formatNumber(b.readCount)} reads</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="admin-empty-state"><Icon name="leaderboard" /><p>No campaigns with reads yet.</p></div>
                  )}
                </SectionCard>
                <SectionCard title="Engagement overview" icon="insights">
                  <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 6 }}>
                    <div className="nbc-progress">
                      <span>Read</span>
                      <div className="nbc-progress__bar">
                        <div className="nbc-progress__fill nbc-progress__fill--read"
                          style={{ width: `${analytics?.readRate ?? 0}%` }} />
                      </div>
                      <span>{analytics?.readRate ?? 0}%</span>
                    </div>
                    <div className="nbc-progress">
                      <span>Clicked</span>
                      <div className="nbc-progress__bar">
                        <div className="nbc-progress__fill nbc-progress__fill--clicked"
                          style={{ width: `${analytics?.clickRate ?? 0}%` }} />
                      </div>
                      <span>{analytics?.clickRate ?? 0}%</span>
                    </div>
                    <div className="nbc-progress">
                      <span>Delivered</span>
                      <div className="nbc-progress__bar">
                        <div className="nbc-progress__fill"
                          style={{ width: `${analytics?.deliverySuccess ?? 0}%` }} />
                      </div>
                      <span>{analytics?.deliverySuccess ?? 0}%</span>
                    </div>
                  </div>
                </SectionCard>
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════ DETAIL DRAWER ════════════════ */}
      {selected !== null && (
        <div className="nbc-drawer-overlay" onClick={closeDetail}>
          <div className="nbc-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="nbc-drawer__head">
              <div>
                <p className="admin-eyebrow">Broadcast #{selected}</p>
                {detail ? (
                  <h3>{detail.title}</h3>
                ) : (
                  <h3>Loading…</h3>
                )}
              </div>
              <button type="button" className="nbc-drawer__close" onClick={closeDetail} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>

            <div className="nbc-drawer__body">
              {loadingDetail && !detail ? (
                <div className="nbc-skeleton-table">
                  {Array.from({ length: 5 }).map((_, i) => <div key={i} className="nbc-skeleton-row" />)}
                </div>
              ) : detail ? (
                <>
                  {/* Status strip */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <StatusPill status={detail.status} />
                    <TypePill type={detail.type} />
                    <PriorityPill priority={detail.priority} />
                    {detail.repeatType && detail.repeatType !== "NONE" && (
                      <span className="admin-count-badge">Repeats {detail.repeatType.toLowerCase()}</span>
                    )}
                  </div>

                  {/* Message */}
                  <div className="nbc-detail-section">
                    <h4>Message</h4>
                    {detail.subtitle && <p className="admin-text-muted" style={{ margin: "0 0 8px", fontWeight: 700 }}>{detail.subtitle}</p>}
                    <p className="nbc-detail-message">{detail.message}</p>
                    {(detail.actionButtonText || detail.actionUrl) && (
                      <div style={{ marginTop: 10 }}>
                        <span className="nbc-preview__action" style={{ width: "auto", display: "inline-block", padding: "8px 16px" }}>
                          {detail.actionButtonText || "Open"} {detail.actionUrl ? `· ${detail.actionUrl}` : ""}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="nbc-detail-section">
                    <h4>Details</h4>
                    <div className="nbc-detail-row"><span>Audience</span><span>{scopeLabel(detail.targetScope)}</span></div>
                    <div className="nbc-detail-row"><span>Created by</span><span>{detail.createdByName || "Unknown"}</span></div>
                    <div className="nbc-detail-row"><span>Created</span><span>{formatDateTime(detail.createdAt)}</span></div>
                    <div className="nbc-detail-row"><span>Scheduled</span><span>{formatDateTime(detail.scheduleTime)}</span></div>
                    <div className="nbc-detail-row"><span>Sent</span><span>{formatDateTime(detail.sentAt)}</span></div>
                    <div className="nbc-detail-row"><span>Expires</span><span>{formatDateTime(detail.expiresAt)}</span></div>
                    {detail.targetDetail && (
                      <div className="nbc-detail-row"><span>Target detail</span><span style={{ maxWidth: "55%", wordBreak: "break-word" }}>{detail.targetDetail}</span></div>
                    )}
                  </div>

                  {/* Delivery tracking */}
                  <div className="nbc-detail-section">
                    <h4>Delivery tracking</h4>
                    {[
                      { label: "Delivered", value: detail.delivered ?? detail.totalTargets ?? 0, color: "" },
                      { label: "Read", value: detail.read ?? 0, color: "read" },
                      { label: "Clicked", value: detail.clicked ?? 0, color: "clicked" },
                      { label: "Failed", value: detail.failedDeliveries ?? detail.failedCount ?? 0, color: "failed" },
                    ].map((r) => (
                      <div key={r.label} className="nbc-detail-row">
                        <span>{r.label}</span>
                        <span>{formatNumber(r.value)}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                      <div className="nbc-progress">
                        <span>Read</span>
                        <div className="nbc-progress__bar">
                          <div className="nbc-progress__fill nbc-progress__fill--read"
                            style={{ width: `${(detail.delivered ?? detail.totalTargets ?? 0) ? Math.round(((detail.read ?? 0) / (detail.delivered ?? detail.totalTargets ?? 1)) * 100) : 0}%` }} />
                        </div>
                        <span>{Math.round(((detail.read ?? 0) / ((detail.delivered ?? detail.totalTargets) || 1)) * 100)}%</span>
                      </div>
                      <div className="nbc-progress">
                        <span>Unread</span>
                        <div className="nbc-progress__bar">
                          <div className="nbc-progress__fill"
                            style={{ width: `${(detail.delivered ?? detail.totalTargets) > 0 ? Math.round(((detail.unread ?? 0) / (detail.delivered ?? detail.totalTargets)) * 100) : 0}%` }} />
                        </div>
                        <span>{formatNumber(detail.unread ?? 0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Recipients */}
                  <div className="nbc-detail-section">
                    <h4>Recent recipients</h4>
                    {recipients?.content?.length > 0 ? (
                      recipients.content.map((r) => (
                        <div className="nbc-recipient" key={r.id}>
                          <span className="nbc-recipient__avatar">{initials(r.userName)}</span>
                          <div className="nbc-recipient__main">
                            <div className="nbc-recipient__name">{r.userName}</div>
                            <div className="nbc-recipient__email">{r.userEmail}</div>
                          </div>
                          <span className={`nbc-recipient__status ${r.clickedAt ? "nbc-recipient__status--clicked" : r.read ? "nbc-recipient__status--read" : "nbc-recipient__status--unread"}`}>
                            {r.clickedAt ? "clicked" : r.read ? "read" : "unread"}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="nbc-empty-hint">No individual deliveries recorded yet.</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {(detail.status === "DRAFT" || detail.status === "SCHEDULED") && (
                      <>
                        <button type="button" className="admin-action-btn admin-action-approve" onClick={() => handleSendNow(detail.id)}>
                          <Icon name="send" /> Send now
                        </button>
                        {detail.status === "SCHEDULED" && (
                          <button type="button" className="admin-action-btn admin-action-cancel" onClick={() => handleCancel(detail.id)}>
                            <Icon name="block" /> Cancel
                          </button>
                        )}
                      </>
                    )}
                    {(detail.status === "SENT" || detail.status === "FAILED") && (
                      <button type="button" className="admin-action-btn admin-action-approve" onClick={() => handleResend(detail.id)}>
                        <Icon name="replay" /> Resend unread
                      </button>
                    )}
                    <button type="button" className="admin-action-btn admin-action-cancel" onClick={() => handleArchive(detail.id)}>
                      <Icon name="archive" /> Archive
                    </button>
                    <button type="button" className="admin-action-btn admin-action-delete" onClick={() => handleDelete(detail.id)}>
                      <Icon name="delete" /> Delete
                    </button>
                  </div>
                </>
              ) : (
                <div className="admin-empty-state">
                  <Icon name="error" />
                  <p>Could not load broadcast details.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
