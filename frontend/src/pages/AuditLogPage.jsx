import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import HeroSection from "../components/HeroSection";
import SectionCard from "../modules/common/dashboard/SectionCard";
import TrendChart from "../modules/common/dashboard/TrendChart";
import "./AdminOperationsPage.css";
import "./AuditLogPage.css";
import "../modules/admin/ui/admin-ui.css";

/* ── Static config ─────────────────────────────────────────────── */

const SEVERITIES = ["INFO", "SUCCESS", "WARNING", "ERROR", "CRITICAL"];

const MODULES = [
  { value: "AUTH", label: "Authentication", icon: "lock" },
  { value: "USER", label: "User Management", icon: "person" },
  { value: "SESSION", label: "Sessions", icon: "calendar_month" },
  { value: "SKILL", label: "Skills", icon: "school" },
  { value: "REPORT", label: "Reports", icon: "flag" },
  { value: "MODERATION", label: "Moderation", icon: "gavel" },
  { value: "PAYMENT", label: "Payments", icon: "payments" },
  { value: "NOTIFICATION", label: "Notifications", icon: "notifications" },
  { value: "ADMIN", label: "Admin", icon: "admin_panel_settings" },
  { value: "SYSTEM", label: "System", icon: "dns" },
  { value: "SECURITY", label: "Security", icon: "security" },
];

const SEVERITY_META = {
  INFO: { color: "#64748b", bg: "#f1f5f9" },
  SUCCESS: { color: "#16a34a", bg: "#dcfce7" },
  WARNING: { color: "#d97706", bg: "#fef3c7" },
  ERROR: { color: "#dc2626", bg: "#fee2e2" },
  CRITICAL: { color: "#b91c1c", bg: "#fecaca" },
};

const DATE_PRESETS = [
  { key: "", label: "All time" },
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
];

const RETENTION_OPTIONS = [30, 90, 180, 365];

const PAGE_SIZE = 25;

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
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const formatDateOnly = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric" }).format(d);
};

const formatRelative = (value) => {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateOnly(value);
};

const formatAction = (action) => {
  if (!action) return "Unknown action";
  return action.toLowerCase().split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
};

const moduleLabel = (module) => MODULES.find((m) => m.value === module)?.label || module || "—";

const moduleIcon = (module) => MODULES.find((m) => m.value === module)?.icon || "history";

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

function KpiCard({ label, value, icon, tone = "" }) {
  const animated = useCountUp(value);
  return (
    <div className={`al-kpi${tone ? ` al-kpi--${tone}` : ""}`}>
      <span className="al-kpi__icon"><Icon name={icon} /></span>
      <div className="al-kpi__body">
        <p className="al-kpi__value">{formatNumber(Math.round(animated))}</p>
        <p className="al-kpi__label">{label}</p>
      </div>
    </div>
  );
}

/* ── Severity / module / outcome pills ─────────────────────────── */
function SeverityPill({ severity }) {
  const meta = SEVERITY_META[severity || "INFO"] || SEVERITY_META.INFO;
  return (
    <span className="al-sev-pill" style={{ color: meta.color, background: meta.bg }}>
      {severity || "INFO"}
    </span>
  );
}

function ModulePill({ module }) {
  return (
    <span className="al-mod-pill">
      <Icon name={moduleIcon(module)} /> {moduleLabel(module)}
    </span>
  );
}

function OutcomePill({ outcome }) {
  const success = (outcome || "SUCCESS") === "SUCCESS";
  return (
    <span className={`al-outcome-pill al-outcome-pill--${success ? "ok" : "fail"}`}>
      <span className="al-outcome-pill__dot" /> {outcome || "SUCCESS"}
    </span>
  );
}

/* ── Action icon mapping (timeline) ────────────────────────────── */
const ACTION_ICON = (action) => {
  const a = (action || "").toUpperCase();
  if (a.includes("LOGIN")) return "login";
  if (a.includes("LOGOUT")) return "logout";
  if (a.includes("FAILED")) return "error";
  if (a.includes("PASSWORD")) return "key";
  if (a.includes("VERIFICATION") || a.includes("VERIFY")) return "verified_user";
  if (a.includes("DISABLE") || a.includes("SUSPEND") || a.includes("BLOCK")) return "block";
  if (a.includes("ENABLE") || a.includes("RESTORE") || a.includes("UNSUSPEND")) return "check_circle";
  if (a.includes("DELETE")) return "delete";
  if (a.includes("CREATE") || a.includes("ADD")) return "add_circle";
  if (a.includes("UPDATE") || a.includes("EDIT") || a.includes("CHANGE") || a.includes("SET")) return "edit";
  if (a.includes("APPROVE")) return "thumb_up";
  if (a.includes("REJECT") || a.includes("DENY")) return "thumb_down";
  if (a.includes("PAYMENT") || a.includes("REFUND") || a.includes("ESCROW") || a.includes("WALLET")) return "payments";
  if (a.includes("SESSION") || a.includes("BOOKING")) return "calendar_month";
  if (a.includes("SKILL")) return "school";
  if (a.includes("REPORT")) return "flag";
  if (a.includes("MODERAT") || a.includes("WARN")) return "gavel";
  if (a.includes("NOTIF") || a.includes("BROADCAST") || a.includes("EMAIL")) return "notifications";
  if (a.includes("SETTINGS") || a.includes("CONFIG")) return "settings";
  if (a.includes("RESET_ALL")) return "restart_alt";
  if (a.includes("PURGE")) return "cleaning_services";
  if (a.includes("RETENTION")) return "hourglass_top";
  return "history";
};

const ACTION_COLOR = (severity) => SEVERITY_META[severity || "INFO"]?.color || "#64748b";

/* ════════════════════════════════════════════════════════════════
   Main page
   ════════════════════════════════════════════════════════════════ */
export default function AuditLogPage({ notify }) {
  const [tab, setTab] = useState("overview"); // overview | timeline | security | retention

  // ── Overview stats ──
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(null);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // ── Timeline ──
  const [logs, setLogs] = useState(null);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [view, setView] = useState("timeline"); // timeline | list
  const [filters, setFilters] = useState({
    action: "",
    module: "",
    severity: "",
    outcome: "",
    entityType: "",
    q: "",
    preset: "",
    fromDate: "",
    toDate: "",
  });
  const [page, setPage] = useState(0);
  const searchTimerRef = useRef(null);
  const logsReqRef = useRef(0);

  // ── Detail drawer ──
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Retention ──
  const [retention, setRetention] = useState(null);
  const [loadingRetention, setLoadingRetention] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [purging, setPurging] = useState(false);

  // ── Auto refresh ──
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [exporting, setExporting] = useState({ csv: false, xlsx: false, pdf: false });

  const lastErrorRef = useRef(null);

  /* ── Single-toast helper (no duplicate toasts) ──────────────── */
  const notifyOnce = useCallback((type, title, message) => {
    const key = `${title}|${message}`;
    const now = Date.now();
    const last = lastErrorRef.current;
    if (last && last.key === key && now - last.ts < 2500) return;
    lastErrorRef.current = { key, ts: now };
    notify?.({ type, title, message });
  }, [notify]);

  /* ── Overview stats ─────────────────────────────────────────── */
  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const res = await client.get("/api/v1/admin/audit-log/stats");
      setStats(unwrap(res) || null);
    } catch (err) {
      notifyOnce("error", "Stats unavailable", errorMessage(err, "Could not load audit statistics."));
    } finally {
      setLoadingStats(false);
    }
  }, [notifyOnce]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  /* ── Security alerts ────────────────────────────────────────── */
  const loadSecurityAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const res = await client.get("/api/v1/admin/audit-log/security-alerts");
      setSecurityAlerts(unwrap(res) || null);
    } catch (err) {
      notifyOnce("error", "Alerts unavailable", errorMessage(err, "Could not load security alerts."));
    } finally {
      setLoadingAlerts(false);
    }
  }, [notifyOnce]);

  // Load security alerts lazily when the Security tab is first opened.
  useEffect(() => {
    if (tab === "security" && !securityAlerts && !loadingAlerts) {
      loadSecurityAlerts();
    }
  }, [tab, securityAlerts, loadingAlerts, loadSecurityAlerts]);

  /* ── Timeline ───────────────────────────────────────────────── */
  const loadLogs = useCallback(async (pageNum = 0) => {
    const reqId = ++logsReqRef.current;
    setLoadingLogs(true);
    try {
      const params = { page: pageNum, size: PAGE_SIZE };
      if (filters.action.trim()) params.action = filters.action.trim();
      if (filters.module) params.module = filters.module;
      if (filters.severity) params.severity = filters.severity;
      if (filters.outcome) params.outcome = filters.outcome;
      if (filters.entityType.trim()) params.entityType = filters.entityType.trim();
      if (filters.q.trim()) params.q = filters.q.trim();
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      const res = await client.get("/api/v1/admin/audit-log", { params });
      if (reqId !== logsReqRef.current) return; // stale response guard
      setLogs(unwrap(res) || null);
      setPage(pageNum);
    } catch (err) {
      if (reqId !== logsReqRef.current) return;
      notifyOnce("error", "Audit log unavailable", errorMessage(err, "Could not load the activity timeline."));
    } finally {
      if (reqId === logsReqRef.current) setLoadingLogs(false);
    }
  }, [filters, notifyOnce]);

  // Debounced load — fires on mount too (covers the initial load).
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadLogs(0);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [filters, loadLogs]);

  // Auto refresh (15s) — deduped via notifyOnce.
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadLogs(page);
      loadStats();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadLogs, loadStats, page]);

  /* ── Detail drawer ──────────────────────────────────────────── */
  const openDetail = useCallback(async (id) => {
    setSelected(id);
    setDetail(null);
    setLoadingDetail(true);
    try {
      const res = await client.get(`/api/v1/admin/audit-log/${id}`);
      setDetail(unwrap(res) || null);
    } catch (err) {
      notifyOnce("error", "Details unavailable", errorMessage(err, "Could not load the audit entry."));
    } finally {
      setLoadingDetail(false);
    }
  }, [notifyOnce]);

  const closeDetail = useCallback(() => {
    setSelected(null);
    setDetail(null);
  }, []);

  /* ── Retention ──────────────────────────────────────────────── */
  const loadRetention = useCallback(async () => {
    setLoadingRetention(true);
    try {
      const res = await client.get("/api/v1/admin/audit-log/retention");
      const data = unwrap(res) || {};
      setRetention(data);
      setRetentionDays(Number(data.days) || 365);
    } catch (err) {
      notifyOnce("error", "Retention unavailable", errorMessage(err, "Could not load the retention policy."));
    } finally {
      setLoadingRetention(false);
    }
  }, [notifyOnce]);

  useEffect(() => {
    if (tab === "retention" && !retention && !loadingRetention) {
      loadRetention();
    }
  }, [tab, retention, loadingRetention, loadRetention]);

  const handleSaveRetention = async () => {
    try {
      const res = await client.put("/api/v1/admin/audit-log/retention", { days: retentionDays });
      setRetention(unwrap(res) || {});
      notify?.({ type: "success", title: "Retention updated", message: `Audit entries older than ${retentionDays} days will be purged.` });
    } catch (err) {
      notifyOnce("error", "Update failed", errorMessage(err, "Could not update the retention policy."));
    }
  };

  const handlePurge = async () => {
    if (!window.confirm("Purge expired audit entries now?\n\nThis permanently deletes entries older than the retention window. This action is itself recorded in the audit log.")) return;
    setPurging(true);
    try {
      const res = await client.post("/api/v1/admin/audit-log/purge");
      const data = unwrap(res) || {};
      notify?.({ type: "success", title: "Purge complete", message: `${formatNumber(data.removed)} expired audit entries removed.` });
      await loadRetention();
    } catch (err) {
      notifyOnce("error", "Purge failed", errorMessage(err, "Could not purge expired audit entries."));
    } finally {
      setPurging(false);
    }
  };

  /* ── Export ─────────────────────────────────────────────────── */
  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportRows = useMemo(() => {
    const rows = logs?.content || [];
    return [
      ["SkillSwap — Activity Timeline Export"],
      ["Generated", new Date().toISOString()],
      ["Filters", [
        filters.action && `action=${filters.action}`,
        filters.module && `module=${filters.module}`,
        filters.severity && `severity=${filters.severity}`,
        filters.outcome && `outcome=${filters.outcome}`,
        filters.q && `q=${filters.q}`,
        filters.fromDate && `from=${filters.fromDate}`,
        filters.toDate && `to=${filters.toDate}`,
      ].filter(Boolean).join(" · ") || "none"],
      [],
      ["ID", "Action", "Module", "Severity", "Outcome", "Actor", "Target", "Details", "IP", "Browser", "Device", "OS", "Created"],
      ...rows.map((l) => [
        l.id,
        l.action,
        l.module || "",
        l.severity || "INFO",
        l.outcome || "SUCCESS",
        l.adminEmail || (l.userId ? `User #${l.userId}` : "System"),
        l.entityType ? `${l.entityType}${l.entityId ? `#${l.entityId}` : ""}` : (l.resource ? `${l.resource}${l.resourceId ? `#${l.resourceId}` : ""}` : ""),
        (l.details || "").replace(/[\r\n]+/g, " "),
        l.ipAddress || "",
        l.browser || "",
        l.device || "",
        l.os || "",
        l.createdAt || "",
      ]),
    ];
  }, [logs, filters]);

  const handleExportCsv = useCallback(() => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const csv = exportRows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `activity-timeline-${new Date().toISOString().slice(0, 10)}.csv`);
      notify?.({ type: "success", title: "CSV ready", message: "Timeline exported as CSV." });
    } catch {
      notifyOnce("error", "Export failed", "Could not generate CSV.");
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  }, [exportRows, notify, notifyOnce]);

  const handleExportXlsx = useCallback(async () => {
    setExporting((prev) => ({ ...prev, xlsx: true }));
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SkillSwap";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("Activity Timeline", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.addRows(exportRows);
      sheet.columns.forEach((col) => {
        col.width = 24;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `activity-timeline-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      notify?.({ type: "success", title: "Excel ready", message: "Timeline exported as Excel." });
    } catch {
      notifyOnce("error", "Export failed", "Could not generate Excel file.");
    } finally {
      setExporting((prev) => ({ ...prev, xlsx: false }));
    }
  }, [exportRows, notify, notifyOnce]);

  const handleExportPdf = useCallback(async () => {
    setExporting((prev) => ({ ...prev, pdf: true }));
    try {
      const { default: jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      const rows = logs?.content || [];
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("SkillSwap — Activity Timeline", 14, 16);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);
      doc.autoTable({
        startY: 30,
        head: [["ID", "Action", "Severity", "Actor", "Target", "Details", "IP", "Created"]],
        body: rows.map((l) => [
          String(l.id),
          l.action || "",
          l.severity || "INFO",
          l.adminEmail || (l.userId ? `User #${l.userId}` : "System"),
          l.entityType ? `${l.entityType}${l.entityId ? `#${l.entityId}` : ""}` : "",
          (l.details || "").replace(/[\r\n]+/g, " "),
          l.ipAddress || "",
          l.createdAt || "",
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`activity-timeline-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify?.({ type: "success", title: "PDF ready", message: "Timeline report downloaded as PDF." });
    } catch {
      notifyOnce("error", "Export failed", "Could not generate PDF.");
    } finally {
      setExporting((prev) => ({ ...prev, pdf: false }));
    }
  }, [logs, notify, notifyOnce]);

  /* ── Derived helpers ────────────────────────────────────────── */
  const timelineRows = logs?.content || [];
  const totalPages = Math.max(0, logs?.totalPages || 0);

  const resetFilters = () => {
    setFilters({ action: "", module: "", severity: "", outcome: "", entityType: "", q: "", preset: "", fromDate: "", toDate: "" });
    setPage(0);
  };

  const applyPreset = (key) => {
    if (!key) {
      setFilters((prev) => ({ ...prev, preset: "", fromDate: "", toDate: "" }));
      return;
    }
    const preset = DATE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const to = new Date();
    const from = new Date(to.getTime() - preset.days * 86400000);
    setFilters((prev) => ({
      ...prev,
      preset: key,
      fromDate: from.toISOString().slice(0, 10),
      toDate: to.toISOString().slice(0, 10),
    }));
  };

  const renderTimelineItem = (l) => {
    const color = ACTION_COLOR(l.severity);
    const actor = l.adminEmail || (l.userId ? `User #${l.userId}` : "System");
    const target = l.entityType
      ? `${l.entityType}${l.entityId ? ` #${l.entityId}` : ""}`
      : l.resource
        ? `${l.resource}${l.resourceId ? ` #${l.resourceId}` : ""}`
        : null;
    return (
      <div key={l.id} className="al-item" style={{ borderLeftColor: color }}>
        <div className="al-item__dot" style={{ background: `${color}1a`, color }}>
          <Icon name={ACTION_ICON(l.action)} />
        </div>
        <div className="al-item__body">
          <div className="al-item__head">
            <strong className="al-item__action">{formatAction(l.action)}</strong>
            <span className="al-item__time" title={formatDateTime(l.createdAt)}>{formatRelative(l.createdAt)}</span>
          </div>
          <p className="al-item__details">{l.details || "No details"}</p>
          <div className="al-item__meta">
            <span className="al-item__actor"><Icon name="person" /> {actor}</span>
            {target && <span className="al-item__actor"><Icon name="tag" /> {target}</span>}
            <SeverityPill severity={l.severity} />
            <OutcomePill outcome={l.outcome} />
            <ModulePill module={l.module} />
            {l.ipAddress && l.ipAddress !== "unknown" && (
              <span className="al-item__actor"><Icon name="public" /> {l.ipAddress}</span>
            )}
            {l.device && <span className="al-item__actor"><Icon name="devices" /> {l.device}</span>}
            {l.browser && <span className="al-item__actor"><Icon name="language" /> {l.browser}</span>}
          </div>
        </div>
        <button type="button" className="al-icon-btn" title="View details" onClick={() => openDetail(l.id)}>
          <Icon name="visibility" />
        </button>
      </div>
    );
  };

  const renderTableRow = (l) => {
    const actor = l.adminEmail || (l.userId ? `User #${l.userId}` : "System");
    const target = l.entityType
      ? `${l.entityType}${l.entityId ? ` #${l.entityId}` : ""}`
      : l.resource
        ? `${l.resource}${l.resourceId ? ` #${l.resourceId}` : ""}`
        : "";
    return (
      <tr key={l.id}>
        <td className="al-cell-num">#{l.id}</td>
        <td>
          <div className="al-table-action" title={l.action}>{formatAction(l.action)}</div>
          {target && <div className="al-table-sub">{target}</div>}
        </td>
        <td><ModulePill module={l.module} /></td>
        <td><SeverityPill severity={l.severity} /></td>
        <td><OutcomePill outcome={l.outcome} /></td>
        <td title={l.details} className="al-cell-details">{l.details || "—"}</td>
        <td>{actor}</td>
        <td className="al-cell-num">{l.ipAddress && l.ipAddress !== "unknown" ? l.ipAddress : "—"}</td>
        <td className="al-cell-num" title={formatDateTime(l.createdAt)}>{formatDateOnly(l.createdAt)}</td>
        <td>
          <button type="button" className="al-icon-btn" title="View details" onClick={() => openDetail(l.id)}>
            <Icon name="visibility" />
          </button>
        </td>
      </tr>
    );
  };

  const detailRows = detail
    ? [
        ["Action", formatAction(detail.action)],
        ["Module", moduleLabel(detail.module)],
        ["Severity", detail.severity || "INFO"],
        ["Outcome", detail.outcome || "SUCCESS"],
        ["Affected user", detail.userId ? `User #${detail.userId}` : "—"],
        ["Admin", detail.adminEmail || "—"],
        ["Entity", detail.entityType ? `${detail.entityType}${detail.entityId ? ` #${detail.entityId}` : ""}` : (detail.resource ? `${detail.resource}${detail.resourceId ? ` #${detail.resourceId}` : ""}` : "—")],
        ["Timestamp", formatDateTime(detail.createdAt)],
        ["IP address", detail.ipAddress || "—"],
        ["Device", detail.device || "—"],
        ["Browser", detail.browser || "—"],
        ["Operating system", detail.os || "—"],
        ["Request ID", detail.requestId || "—"],
        ["Correlation ID", detail.correlationId || "—"],
        ["API endpoint", detail.endpoint || "—"],
        ["Before value", detail.beforeValue || "—"],
        ["After value", detail.afterValue || "—"],
        ["Archived", detail.archivedAt ? formatDateTime(detail.archivedAt) : "No"],
      ]
    : [];

  /* ════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════ */
  return (
    <section className="admin-page">
      {/* ── Hero ── */}
      <HeroSection
      className="hero-section--compact"
        badge="Monitoring · Security"
        title="Activity Timeline & Security Audit"
        subtitle="Enterprise-grade audit trail — who did what, when, and from where. Entries are immutable and read-only."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">manage_search</span>
          </div>
        }
      >
        <label className="al-autorefresh" title="Refresh every 15 seconds">
          <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
          Auto refresh
        </label>
        <button
          type="button"
          className="hero-section__btn hero-section__btn--primary"
          onClick={() => { loadStats(); loadLogs(page); }}
        >
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      </HeroSection>

      {/* ── Tabs ── */}
      <div className="al-tabs">
        {[
          { key: "overview", label: "Overview", icon: "space_dashboard" },
          { key: "timeline", label: "Timeline", icon: "timeline" },
          { key: "security", label: "Security", icon: "security" },
          { key: "retention", label: "Retention", icon: "hourglass_top" },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            className={`al-tab${tab === t.key ? " al-tab--active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} /> {t.label}
          </button>
        ))}
      </div>

      {/* ════════════════ OVERVIEW ════════════════ */}
      {tab === "overview" && (
        <>
          {loadingStats && !stats ? (
            <div className="al-kpi-grid">
              {Array.from({ length: 9 }).map((_, i) => <div key={i} className="al-skeleton-card" />)}
            </div>
          ) : (
            <>
              <div className="al-kpi-grid">
                <KpiCard label="Total audit logs" value={stats?.totalLogs} icon="receipt_long" tone="slate" />
                <KpiCard label="Today's activities" value={stats?.todayActivities} icon="today" tone="blue" />
                <KpiCard label="Last 24 hours" value={stats?.last24h} icon="schedule" tone="cyan" />
                <KpiCard label="Security events (24h)" value={stats?.securityEvents24h} icon="security" tone="red" />
                <KpiCard label="Failed logins (24h)" value={stats?.failedLogins24h} icon="error" tone="rose" />
                <KpiCard label="Admin actions (30d)" value={stats?.adminActions30d} icon="admin_panel_settings" tone="violet" />
                <KpiCard label="User actions (30d)" value={stats?.userActions30d} icon="person" tone="teal" />
                <KpiCard label="Warnings (24h)" value={stats?.warnings24h} icon="warning" tone="amber" />
                <KpiCard label="Critical events (24h)" value={stats?.critical24h} icon="dangerous" tone="rose" />
              </div>

              <div className="aa-grid">
                <SectionCard title="Activity by day (14 days)" icon="insights" headerExtra={
                  <span className="admin-count-badge">{stats?.dailyTrend?.length || 0} days</span>
                }>
                  {stats?.dailyTrend?.length > 0 && stats.dailyTrend.some((b) => b?.count > 0) ? (
                    <TrendChart
                      data={stats.dailyTrend.map((d) => ({ label: d.label, value: d.count }))}
                      type="area"
                      height={180}
                      gradientId="auditDaily"
                      valueFormatter={(v) => `${v} events`}
                    />
                  ) : (
                    <div className="admin-empty-state"><Icon name="insights" /><p>No activity recorded in this window.</p></div>
                  )}
                </SectionCard>
                <SectionCard title="Severity distribution" icon="donut_small">
                  {stats?.bySeverity?.length > 0 ? (
                    <div className="al-distribution">
                      {stats.bySeverity.map((d) => {
                        const meta = SEVERITY_META[d.label] || SEVERITY_META.INFO;
                        const max = Math.max(...stats.bySeverity.map((x) => Number(x.count)), 1);
                        const pct = Math.max(4, Math.round((Number(d.count) / max) * 100));
                        return (
                          <div className="al-dist-row" key={d.label}>
                            <span className="al-dist-name" style={{ color: meta.color }}>{d.label}</span>
                            <div className="al-dist-track">
                              <div className="al-dist-fill" style={{ width: `${pct}%`, background: meta.color }} />
                            </div>
                            <span className="al-dist-count">{formatNumber(d.count)}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="admin-empty-state"><Icon name="donut_small" /><p>No severity data yet.</p></div>
                  )}
                </SectionCard>
              </div>

              <div className="aa-grid">
                <SectionCard title="Activity by module (30 days)" icon="category" headerExtra={
                  <span className="admin-count-badge">{stats?.byModule?.length || 0} modules</span>
                }>
                  {stats?.byModule?.length > 0 ? (
                    <ul className="al-module-list">
                      {stats.byModule.map((d) => (
                        <li key={d.label}>
                          <span className="al-module-list__name"><Icon name={moduleIcon(d.label)} /> {moduleLabel(d.label)}</span>
                          <span className="al-module-list__count">{formatNumber(d.count)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="admin-empty-state"><Icon name="category" /><p>No module data yet.</p></div>
                  )}
                </SectionCard>
                <SectionCard title="Success rate (24h)" icon="fact_check" headerExtra={
                  <span className="admin-count-badge">{stats?.successRate ?? 0}%</span>
                }>
                  <div style={{ paddingTop: 8 }}>
                    <div className="al-progress" style={{ marginBottom: 14 }}>
                      <span>Successful events</span>
                      <div className="al-progress__bar">
                        <div className="al-progress__fill" style={{ width: `${stats?.successRate ?? 0}%` }} />
                      </div>
                      <span>{stats?.successRate ?? 0}%</span>
                    </div>
                    <div className="al-progress">
                      <span>Failed logins (24h)</span>
                      <div className="al-progress__bar">
                        <div className="al-progress__fill al-progress__fill--danger"
                          style={{ width: `${Math.min(100, stats?.failedLogins24h ? Math.max(4, stats.failedLogins24h * 4) : 0)}%` }} />
                      </div>
                      <span>{formatNumber(stats?.failedLogins24h)}</span>
                    </div>
                    <p className="admin-text-muted" style={{ marginTop: 14 }}>
                      Every metric is a live database count — nothing is hardcoded. Severity and module
                      breakdowns cover the trailing 30 days.
                    </p>
                  </div>
                </SectionCard>
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════ TIMELINE ════════════════ */}
      {tab === "timeline" && (
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">Timeline</p>
              <h2>Activity timeline</h2>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="al-view-toggle">
                <button
                  type="button"
                  className={`al-view-btn${view === "timeline" ? " is-active" : ""}`}
                  onClick={() => setView("timeline")}
                  title="Timeline view"
                >
                  <Icon name="timeline" /> Timeline
                </button>
                <button
                  type="button"
                  className={`al-view-btn${view === "list" ? " is-active" : ""}`}
                  onClick={() => setView("list")}
                  title="Table view"
                >
                  <Icon name="table" /> Table
                </button>
              </div>
              <button type="button" className="admin-refresh-btn" onClick={() => loadLogs(page)}>
                <Icon name="refresh" /> Refresh
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="al-filters">
            <div className="admin-search" style={{ flex: 1, minWidth: 220 }}>
              <Icon name="search" />
              <input
                type="text"
                value={filters.q}
                onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
                placeholder="Search action, user, email, IP, browser, device…"
                aria-label="Search audit log"
              />
            </div>
            <input
              type="text"
              value={filters.action}
              onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
              placeholder="Action (e.g. LOGIN)"
              aria-label="Filter by action"
              style={{ maxWidth: 150 }}
            />
            <select value={filters.module} onChange={(e) => setFilters((prev) => ({ ...prev, module: e.target.value }))} aria-label="Filter by module">
              <option value="">All modules</option>
              {MODULES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={filters.severity} onChange={(e) => setFilters((prev) => ({ ...prev, severity: e.target.value }))} aria-label="Filter by severity">
              <option value="">All severities</option>
              {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={filters.outcome} onChange={(e) => setFilters((prev) => ({ ...prev, outcome: e.target.value }))} aria-label="Filter by outcome">
              <option value="">All outcomes</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>
            <input
              type="text"
              value={filters.entityType}
              onChange={(e) => setFilters((prev) => ({ ...prev, entityType: e.target.value }))}
              placeholder="Entity (User, Session…)"
              aria-label="Filter by entity"
              style={{ maxWidth: 150 }}
            />
            <select value={filters.preset} onChange={(e) => applyPreset(e.target.value)} aria-label="Date preset">
              {DATE_PRESETS.map((p) => <option key={p.key || "all"} value={p.key}>{p.label}</option>)}
            </select>
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters((prev) => ({ ...prev, fromDate: e.target.value, preset: "" }))} aria-label="From date" />
            <input type="date" value={filters.toDate} onChange={(e) => setFilters((prev) => ({ ...prev, toDate: e.target.value, preset: "" }))} aria-label="To date" />
            <button type="button" className="admin-action-btn admin-action-cancel" onClick={resetFilters}>
              <Icon name="filter_alt_off" /> Reset
            </button>
          </div>

          {/* Export */}
          <div className="al-export-bar">
            <span className="admin-text-muted">
              <Icon name="info" /> Export reflects the current filters. Entries are read-only; they can only be purged via the Retention tab.
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="admin-refresh-btn" onClick={handleExportCsv} disabled={exporting.csv} style={{ background: "#059669", padding: "6px 12px", fontSize: "0.8rem" }}>
                <Icon name="table_chart" /> {exporting.csv ? "…" : "CSV"}
              </button>
              <button type="button" className="admin-refresh-btn" onClick={handleExportXlsx} disabled={exporting.xlsx} style={{ background: "#1d4ed8", padding: "6px 12px", fontSize: "0.8rem" }}>
                <Icon name="grid_on" /> {exporting.xlsx ? "…" : "Excel"}
              </button>
              <button type="button" className="admin-refresh-btn" onClick={handleExportPdf} disabled={exporting.pdf} style={{ background: "#b91c1c", padding: "6px 12px", fontSize: "0.8rem" }}>
                <Icon name="picture_as_pdf" /> {exporting.pdf ? "…" : "PDF"}
              </button>
            </div>
          </div>

          {/* Results */}
          {loadingLogs && !logs ? (
            <div className="al-skeleton-table">
              {Array.from({ length: 6 }).map((_, i) => <div key={i} className="al-skeleton-row" />)}
            </div>
          ) : timelineRows.length === 0 ? (
            <div className="admin-empty-state">
              <span className="material-symbols-outlined" style={{ fontSize: "2.4rem" }}>history_toggle_off</span>
              <h3 style={{ margin: "6px 0 0", color: "var(--admin-text)" }}>No audit entries found</h3>
              <p style={{ maxWidth: "40ch", margin: "6px 0 0" }}>
                {filters.q || filters.action || filters.module || filters.severity || filters.outcome
                  ? "No entries match your filters. Try clearing some."
                  : "No activity has been recorded yet. Login, admin actions and security events will appear here automatically."}
              </p>
              {!filters.q && !filters.action && !filters.module && !filters.severity && (
                <button type="button" className="admin-refresh-btn" onClick={loadLogs} style={{ marginTop: 8 }}>
                  <Icon name="refresh" /> Refresh
                </button>
              )}
            </div>
          ) : view === "timeline" ? (
            <div className="al-timeline">
              {timelineRows.map(renderTimelineItem)}
            </div>
          ) : (
            <div className="al-table-wrap">
              <table className="al-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Action / Target</th>
                    <th>Module</th>
                    <th>Severity</th>
                    <th>Outcome</th>
                    <th>Details</th>
                    <th>Actor</th>
                    <th>IP</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>View</th>
                  </tr>
                </thead>
                <tbody>
                  {timelineRows.map(renderTableRow)}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {logs && timelineRows.length > 0 && (
            <div className="al-pagination">
              <span className="al-pagination__info">
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, logs.totalElements || 0)} of {formatNumber(logs.totalElements || 0)}
              </span>
              <div className="al-pagination__btns">
                <button type="button" className="al-page-btn" disabled={page <= 0} onClick={() => loadLogs(page - 1)}>
                  ← Prev
                </button>
                <button type="button" className="al-page-btn" disabled={page >= totalPages - 1} onClick={() => loadLogs(page + 1)}>
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ SECURITY ════════════════ */}
      {tab === "security" && (
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">Security monitoring</p>
              <h2>Security alerts</h2>
            </div>
            <button type="button" className="admin-refresh-btn" onClick={loadSecurityAlerts}>
              <Icon name="refresh" /> Refresh
            </button>
          </div>

          {loadingAlerts && !securityAlerts ? (
            <div className="al-skeleton-table">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="al-skeleton-row" />)}
            </div>
          ) : !securityAlerts || securityAlerts.totalAlerts === 0 ? (
            <div className="admin-empty-state">
              <span className="material-symbols-outlined" style={{ fontSize: "2.4rem" }}>verified_user</span>
              <h3 style={{ margin: "6px 0 0", color: "var(--admin-text)" }}>No security alerts</h3>
              <p style={{ maxWidth: "42ch", margin: "6px 0 0" }}>
                No suspicious patterns detected in the last 24 hours. Repeated failed logins, password resets,
                account disables and privilege changes are flagged here automatically.
              </p>
            </div>
          ) : (
            <div className="al-security-grid">
              <div className="al-alert-card">
                <div className="al-alert-card__head">
                  <span className="al-alert-card__icon al-alert-card__icon--danger"><Icon name="error" /></span>
                  <div>
                    <strong>Repeated failed logins</strong>
                    <span className="al-alert-card__count">{formatNumber(securityAlerts.repeatedFailedLogins?.length)} IP(s)</span>
                  </div>
                </div>
                {securityAlerts.repeatedFailedLogins?.length > 0 ? (
                  <ul className="al-alert-list">
                    {securityAlerts.repeatedFailedLogins.map((a, i) => (
                      <li key={i}><code>{a.key}</code><span>{formatNumber(a.count)} attempts</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-text-muted">No repeated failures detected.</p>
                )}
              </div>

              <div className="al-alert-card">
                <div className="al-alert-card__head">
                  <span className="al-alert-card__icon al-alert-card__icon--warning"><Icon name="key" /></span>
                  <div>
                    <strong>Repeated password resets</strong>
                    <span className="al-alert-card__count">{formatNumber(securityAlerts.repeatedPasswordResets?.length)} user(s)</span>
                  </div>
                </div>
                {securityAlerts.repeatedPasswordResets?.length > 0 ? (
                  <ul className="al-alert-list">
                    {securityAlerts.repeatedPasswordResets.map((a, i) => (
                      <li key={i}><code>{a.key}</code><span>{formatNumber(a.count)} resets</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-text-muted">No repeated resets detected.</p>
                )}
              </div>

              <div className="al-alert-card">
                <div className="al-alert-card__head">
                  <span className="al-alert-card__icon al-alert-card__icon--warning"><Icon name="block" /></span>
                  <div>
                    <strong>Repeated account disables</strong>
                    <span className="al-alert-card__count">{formatNumber(securityAlerts.repeatedAccountDisables?.length)} admin(s)</span>
                  </div>
                </div>
                {securityAlerts.repeatedAccountDisables?.length > 0 ? (
                  <ul className="al-alert-list">
                    {securityAlerts.repeatedAccountDisables.map((a, i) => (
                      <li key={i}><code>{a.key}</code><span>{formatNumber(a.count)} disables</span></li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-text-muted">No repeated disables detected.</p>
                )}
              </div>

              <div className="al-alert-card">
                <div className="al-alert-card__head">
                  <span className="al-alert-card__icon al-alert-card__icon--violet"><Icon name="admin_panel_settings" /></span>
                  <div>
                    <strong>Admin privilege changes (24h)</strong>
                    <span className="al-alert-card__count">{formatNumber(securityAlerts.privilegeChanges?.length)} event(s)</span>
                  </div>
                </div>
                {securityAlerts.privilegeChanges?.length > 0 ? (
                  <ul className="al-alert-list">
                    {securityAlerts.privilegeChanges.map((l) => (
                      <li key={l.id}>
                        <span>{formatAction(l.action)}</span>
                        <span className="admin-text-muted">{formatRelative(l.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="admin-text-muted">No privilege changes in the last 24 hours.</p>
                )}
              </div>
            </div>
          )}

          {/* Recent errors / critical */}
          <div className="al-section" style={{ marginTop: 18 }}>
            <h4><Icon name="report" /> Recent errors &amp; critical events (24h)</h4>
            {securityAlerts?.recentErrors?.length > 0 ? (
              <div className="al-timeline">
                {securityAlerts.recentErrors.map(renderTimelineItem)}
              </div>
            ) : (
              <div className="admin-empty-state"><Icon name="report" /><p>No error or critical events in the last 24 hours.</p></div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════ RETENTION ════════════════ */}
      {tab === "retention" && (
        <div className="admin-panel" style={{ marginTop: 0 }}>
          <div className="admin-section-heading">
            <div>
              <p className="admin-eyebrow">Data retention</p>
              <h2>Audit log retention policy</h2>
            </div>
            <button type="button" className="admin-refresh-btn" onClick={loadRetention}>
              <Icon name="refresh" /> Refresh
            </button>
          </div>

          {loadingRetention && !retention ? (
            <div className="al-skeleton-table">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="al-skeleton-row" />)}
            </div>
          ) : (
            <div className="al-retention">
              <p className="admin-text-muted" style={{ maxWidth: "60ch", marginBottom: 16 }}>
                Retention controls how long audit entries are kept before automatic nightly purging.
                Purged entries are permanently deleted. The retention change and any manual purge are
                themselves recorded in the audit log — the log cannot be edited or tampered with.
              </p>

              <div className="al-retention__options">
                {RETENTION_OPTIONS.map((days) => (
                  <button
                    key={days}
                    type="button"
                    className={`al-retention__opt${retentionDays === days ? " is-active" : ""}`}
                    onClick={() => setRetentionDays(days)}
                  >
                    <strong>{days} days</strong>
                    <span>{days === 30 ? "~1 month" : days === 90 ? "~3 months" : days === 180 ? "~6 months" : "1 year"}</span>
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, alignItems: "center" }}>
                <button type="button" className="admin-refresh-btn" onClick={handleSaveRetention} style={{ background: "#0f766e" }}>
                  <Icon name="save" /> Save retention policy
                </button>
                <button type="button" className="admin-refresh-btn" onClick={handlePurge} disabled={purging} style={{ background: "#b91c1c" }}>
                  <Icon name="cleaning_services" /> {purging ? "Purging…" : "Purge expired now"}
                </button>
                <span className="admin-count-badge" style={{ marginLeft: "auto" }}>
                  <Icon name="history" /> {formatNumber(retention?.expiredCount)} entries currently expired
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════ DETAIL DRAWER ════════════════ */}
      {selected !== null && (
        <div className="al-drawer-overlay" onClick={closeDetail}>
          <div className="al-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="al-drawer__head">
              <div>
                <p className="admin-eyebrow">Audit entry #{selected}</p>
                {detail ? <h3>{formatAction(detail.action)}</h3> : <h3>Loading…</h3>}
              </div>
              <button type="button" className="al-drawer__close" onClick={closeDetail} aria-label="Close">
                <Icon name="close" />
              </button>
            </div>

            <div className="al-drawer__body">
              {loadingDetail && !detail ? (
                <div className="al-skeleton-table">
                  {Array.from({ length: 6 }).map((_, i) => <div key={i} className="al-skeleton-row" />)}
                </div>
              ) : detail ? (
                <>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
                    <SeverityPill severity={detail.severity} />
                    <OutcomePill outcome={detail.outcome} />
                    <ModulePill module={detail.module} />
                    {detail.archivedAt && <span className="admin-count-badge">Archived</span>}
                  </div>

                  <div className="al-detail-section">
                    <h4>Description</h4>
                    <p className="al-detail-message">{detail.details || "No details recorded for this entry."}</p>
                  </div>

                  {(detail.beforeValue || detail.afterValue) && (
                    <div className="al-detail-section">
                      <h4>Value change</h4>
                      <div className="al-value-change">
                        {detail.beforeValue && (
                          <div className="al-value-box">
                            <span className="al-value-box__label">Before</span>
                            <code>{detail.beforeValue}</code>
                          </div>
                        )}
                        <Icon name="arrow_forward" className="al-value-change__arrow" />
                        {detail.afterValue && (
                          <div className="al-value-box al-value-box--after">
                            <span className="al-value-box__label">After</span>
                            <code>{detail.afterValue}</code>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="al-detail-section">
                    <h4>Metadata</h4>
                    <div className="al-detail-grid">
                      {detailRows.map(([k, v]) => (
                        <div className="al-detail-row" key={k}>
                          <span>{k}</span>
                          <strong>{v}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
