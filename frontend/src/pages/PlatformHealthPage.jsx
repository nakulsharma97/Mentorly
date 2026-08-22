import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import HeroSection from "../components/HeroSection";
import StatsCard from "../modules/common/dashboard/StatsCard";
import SectionCard from "../modules/common/dashboard/SectionCard";
import TrendChart from "../modules/common/dashboard/TrendChart";
import "./AdminOperationsPage.css";
import "./PlatformHealthPage.css";
import "../modules/admin/ui/admin-ui.css";

const LEVELS = ["INFO", "WARN", "ERROR", "DEBUG"];

const formatNumber = (v) => Number(v || 0).toLocaleString();

const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
};

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.data?.error || err?.message || fallback;

/* ── Animated counter ─────────────────────────────────────────── */
function useCountUp(target, duration = 750) {
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
      setValue(from + (to - from) * eased);
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

function AnimatedStat({ label, value, icon, tone = "slate", formatter = formatNumber, suffix = "" }) {
  const animated = useCountUp(value);
  return (
    <div className={`ph-stat ph-stat--${tone}`}>
      <span className="ph-stat__icon"><Icon name={icon} /></span>
      <div className="ph-stat__body">
        <p className="ph-stat__value">{formatter(animated)}{suffix}</p>
        <p className="ph-stat__label">{label}</p>
      </div>
    </div>
  );
}

/* ── Progress bar (usage %) ───────────────────────────────────── */
function UsageBar({ value, label, suffix = "%", tone = "auto" }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color = tone === "auto"
    ? pct > 90 ? "var(--ph-danger)" : pct > 75 ? "var(--ph-warn)" : "var(--ph-ok)"
    : tone;
  return (
    <div className="ph-usage">
      <div className="ph-usage__top">
        <span>{label}</span>
        <strong style={{ color }}>{Math.round(pct)}{suffix}</strong>
      </div>
      <div className="ph-usage__track">
        <div className="ph-usage__fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

/* ── Status pill ──────────────────────────────────────────────── */
function StatusPill({ status }) {
  const cls = String(status || "unknown").toLowerCase();
  return (
    <span className={`ph-pill ph-pill--${cls}`}>
      <span className="ph-pill__dot" /> {status || "Unknown"}
    </span>
  );
}

/* ── Alert card ───────────────────────────────────────────────── */
function AlertCard({ alert }) {
  const sev = String(alert?.severity || "INFO").toLowerCase();
  return (
    <div className={`ph-alert ph-alert--${sev}`}>
      <span className="ph-alert__icon">
        <Icon name={sev === "critical" ? "error" : sev === "warning" ? "warning" : "info"} />
      </span>
      <div className="ph-alert__body">
        <strong>{alert.title}</strong>
        <p>{alert.message}</p>
      </div>
    </div>
  );
}

/* ── Microservice row ─────────────────────────────────────────── */
function ServiceRow({ service }) {
  const up = service?.status === "UP";
  return (
    <div className="ph-service">
      <span className={`ph-service__dot ${up ? "is-up" : "is-down"}`} />
      <div className="ph-service__main">
        <strong>{service.name}</strong>
        <small>{up ? "Operational" : "Unavailable"}</small>
      </div>
      <div className="ph-service__meta">
        <span>{service.latencyMs ?? 0} ms</span>
        <small>{service.uptime || "—"} · v{service.version || "dev"}</small>
      </div>
    </div>
  );
}

/* ── Generic info row (two-column list) ───────────────────────── */
function InfoRow({ icon, label, value, valueColor }) {
  return (
    <div className="ph-info">
      <span className="ph-info__label"><Icon name={icon} /> {label}</span>
      <span className="ph-info__value" style={valueColor ? { color: valueColor } : undefined}>{value}</span>
    </div>
  );
}

/* ── Log row ──────────────────────────────────────────────────── */
function LogRow({ entry }) {
  const level = String(entry?.level || "INFO").toLowerCase();
  return (
    <div className="ph-log">
      <span className={`ph-log__level ph-log__level--${level}`}>{entry.level}</span>
      <span className="ph-log__time">{formatDate(entry.timestamp)}</span>
      <span className="ph-log__service">{entry.service}</span>
      <span className="ph-log__message" title={entry.message}>{entry.message}</span>
    </div>
  );
}

export default function PlatformHealthPage({ notify }) {
  // ── Data state ────────────────────────────────────────────────
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState({ csv: false, xlsx: false, pdf: false });

  // ── Auto refresh (ON by default, 15s) ────────────────────────
  const [autoRefresh, setAutoRefresh] = useState(true);

  // ── Log viewer state ─────────────────────────────────────────
  const [logLevel, setLogLevel] = useState("");
  const [logQuery, setLogQuery] = useState("");
  const [logPage, setLogPage] = useState(0);
  const [logs, setLogs] = useState(null);
  const [logsLoading, setLogsLoading] = useState(false);

  const requestRef = useRef(0);
  const lastErrorRef = useRef("");

  // ── Single fetch with stale-response guard (fixes duplicate calls) ──
  const loadHealth = useCallback(async () => {
    const requestId = ++requestRef.current;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout
    try {
      const res = await client.get("/api/v1/admin/health", { signal: controller.signal });
      clearTimeout(timeout);
      if (requestId !== requestRef.current) return; // stale
      setHealth(res?.data?.data || null);
    } catch (err) {
      clearTimeout(timeout);
      if (requestId !== requestRef.current) return;
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
        setError("Request timed out. The server may be slow or unavailable.");
      } else {
        const msg = errorMessage(err, "Could not load health data.");
        setError(msg);
        // Only ONE toast per distinct failure — never spam identical errors.
        if (lastErrorRef.current !== msg) {
          lastErrorRef.current = msg;
          notify?.({ type: "error", title: "Health unavailable", message: msg });
        }
      }
    } finally {
      clearTimeout(timeout);
      if (requestId === requestRef.current) setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  // ── Auto-refresh every 30s — pauses when tab is not visible ──
  useEffect(() => {
    if (!autoRefresh) return;

    let interval;
    const start = () => {
      stop();
      interval = setInterval(loadHealth, 30000);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        loadHealth(); // immediate refresh when tab becomes visible
        start();
      } else {
        stop(); // stop polling when tab is hidden
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    // Start polling only if tab is currently visible
    if (document.visibilityState === "visible") start();

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [autoRefresh, loadHealth]);

  // ── Log viewer fetch (debounced search) ──────────────────────
  const loadLogs = useCallback(async () => {
    setLogsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(logPage), size: "30" });
      if (logLevel) params.set("level", logLevel);
      if (logQuery.trim()) params.set("q", logQuery.trim());
      const res = await client.get(`/api/v1/admin/health/logs?${params.toString()}`);
      setLogs(res?.data?.data || null);
    } catch (err) {
      // The log panel degrades to the embedded payload logs; keep the failure
      // diagnosable without spamming toasts.
      console.warn("Failed to load health logs:", err);
    } finally {
      setLogsLoading(false);
    }
  }, [logLevel, logQuery, logPage]);

  useEffect(() => {
    const timer = setTimeout(loadLogs, logQuery ? 400 : 0);
    return () => clearTimeout(timer);
  }, [loadLogs, logQuery]);

  // ── Export helpers ───────────────────────────────────────────
  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const exportRows = useMemo(() => {
    const h = health || {};
    const s = h.system || {};
    const db = h.database || {};
    const api = h.api || {};
    const q = h.queues || {};
    const sec = h.security || {};
    const err = h.errors || {};
    const act = h.activity || {};
    const rows = [
      ["Platform Health Report", new Date().toISOString().slice(0, 10)],
      ["Overall Status", h.overallStatus || h.status || "unknown"],
      [],
      ["System"],
      ["Metric", "Value"],
      ["Uptime", s.uptimeLabel],
      ["CPU %", s.cpuPercent],
      ["Heap memory %", s.heapPercent],
      ["Non-heap MB", s.nonHeapMb],
      ["Disk usage %", s.diskPercent],
      ["Storage remaining MB", s.diskUsableMb],
      ["Threads", s.threadCount],
      ["JVM", s.jvmVersion],
      ["Java", s.javaVersion],
      ["OS", s.os],
      ["Timezone", s.timezone],
      ["App version", s.appVersion],
      [],
      ["Database"],
      ["Status", db.status],
      ["Response ms", db.responseTimeMs],
      ["Pool usage %", db.poolUsagePercent],
      ["Active / Total", `${db.activeConnections} / ${db.totalConnections}`],
      ["Slow queries", db.slowQueries],
      ["Connection errors", db.connectionErrors],
      ["Size MB", db.dbSizeMb],
      [],
      ["API"],
      ["Total APIs", api.totalApis],
      ["Requests", api.totalRequests],
      ["Failed", api.failedRequests],
      ["Success rate %", api.successRate],
      ["Avg response ms", api.avgResponseTimeMs],
      ["Slowest endpoint", api.slowestEndpoint],
      ["Most requested", api.mostRequestedEndpoint],
      ["Failed today", api.failedToday],
      [],
      ["Queues"],
      ["Notification queue", q.notificationQueue],
      ["Email queue", q.emailQueue],
      ["Background jobs", q.backgroundJobs],
      ["Retry queue", q.retryQueue],
      ["Failed jobs", q.failedJobs],
      ["Pending jobs", q.pendingJobs],
      [],
      ["Security"],
      ["Failed logins (24h)", sec.failedLogins24h],
      ["Blocked users", sec.blockedUsers],
      ["Suspicious requests (24h)", sec.suspiciousRequests24h],
      ["JWT errors (24h)", sec.jwtValidationErrors24h],
      ["Unauthorized (24h)", sec.unauthorizedRequests24h],
      ["Security events (24h)", sec.securityEvents24h],
      [],
      ["Errors"],
      ["Errors today", err.errorsToday],
      ["Critical (24h)", err.criticalErrors24h],
      ["Warnings (24h)", err.warnings24h],
      ["Exceptions (24h)", err.exceptions24h],
      [],
      ["Activity"],
      ["Users online", act.usersOnline],
      ["Mentors online", act.mentorsOnline],
      ["Learners online", act.learnersOnline],
      ["Active sessions", act.activeSessions],
      ["Logins today", act.loginsToday],
      ["Registrations today", act.registrationsToday],
      ["Bookings today", act.bookingsToday],
      [],
      ["Alerts"],
      ["Severity", "Title", "Message"],
      ...(h.alerts || []).map((a) => [a.severity, a.title, a.message]),
      [],
      ["Logs (embedded)"],
      ["Time", "Service", "Level", "Message"],
      ...(h.logs || []).map((l) => [l.timestamp, l.service, l.level, l.message]),
    ];
    return rows;
  }, [health]);

  const handleExportCsv = useCallback(() => {
    setExporting((p) => ({ ...p, csv: true }));
    try {
      const csv = exportRows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `platform-health-${new Date().toISOString().slice(0, 10)}.csv`);
      notify?.({ type: "success", title: "CSV ready", message: "Health report downloaded as CSV." });
    } catch {
      notify?.({ type: "error", title: "Export failed", message: "Could not generate CSV." });
    } finally {
      setExporting((p) => ({ ...p, csv: false }));
    }
  }, [exportRows, notify]);

  const handleExportXlsx = useCallback(async () => {
    setExporting((p) => ({ ...p, xlsx: true }));
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "Mentorly";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("Platform Health", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.addRows(exportRows);
      sheet.columns.forEach((col) => { col.width = 28; });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `platform-health-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      notify?.({ type: "success", title: "Excel ready", message: "Health report downloaded as Excel." });
    } catch {
      notify?.({ type: "error", title: "Export failed", message: "Could not generate Excel file." });
    } finally {
      setExporting((p) => ({ ...p, xlsx: false }));
    }
  }, [exportRows, notify]);

  const handleExportPdf = useCallback(async () => {
    setExporting((p) => ({ ...p, pdf: true }));
    try {
      const { default: jsPDF } = await import("jspdf");
      await import("jspdf-autotable");
      const h = health || {};
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("Mentorly — Platform Health", 14, 16);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()} · Status: ${h.overallStatus || h.status || "unknown"}`, 14, 24);
      doc.autoTable({
        startY: 30,
        head: [["Metric", "Value"]],
        body: [
          ["Overall Status", String(h.overallStatus || h.status || "unknown")],
          ["Uptime", String(h.system?.uptimeLabel || h.uptime || "—")],
          ["CPU %", String(h.system?.cpuPercent ?? "—")],
          ["Heap memory %", String(h.system?.heapPercent ?? "—")],
          ["Disk usage %", String(h.system?.diskPercent ?? "—")],
          ["Database", String(h.database?.status || "—")],
          ["DB response ms", String(h.database?.responseTimeMs ?? "—")],
          ["API success rate %", String(h.api?.successRate ?? "—")],
          ["Total users", String(h.totalUsers ?? 0)],
          ["Total bookings", String(h.totalBookings ?? 0)],
          ["Errors today", String(h.errors?.errorsToday ?? 0)],
          ["Users online", String(h.activity?.usersOnline ?? 0)],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 118, 110] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`platform-health-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify?.({ type: "success", title: "PDF ready", message: "Health report downloaded as PDF." });
    } catch {
      notify?.({ type: "error", title: "Export failed", message: "Could not generate PDF." });
    } finally {
      setExporting((p) => ({ ...p, pdf: false }));
    }
  }, [health, notify]);

  // ── Loading / error / empty states ────────────────────────────
  if (loading && !health) {
    return (
      <section className="admin-page">
        <HeroSection
        className="hero-section--compact"
          badge="Monitoring"
          title="Platform Health"
          subtitle="Loading live monitoring data…"
          illustration={
            <div className="hero-section__watermark" aria-hidden="true">
              <span className="material-symbols-outlined">monitor_heart</span>
            </div>
          }
        />
        <div className="ph-skeleton">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="ph-skeleton__card" />
          ))}
        </div>
      </section>
    );
  }

  if (error && !health) {
    return (
      <section className="admin-page">
        <HeroSection
        className="hero-section--compact"
          badge="Monitoring"
          title="Platform Health"
          subtitle="Could not load monitoring data. Start the backend and ensure you are signed in as an admin."
          primaryButton={
            <button
              type="button"
              className="hero-section__btn hero-section__btn--primary"
              onClick={loadHealth}
            >
              <span className="material-symbols-outlined">refresh</span>
              Retry
            </button>
          }
          illustration={
            <div className="hero-section__watermark" aria-hidden="true">
              <span className="material-symbols-outlined">monitor_heart</span>
            </div>
          }
        />
      </section>
    );
  }

  const h = health || {};
  const s = h.system || {};
  const db = h.database || {};
  const api = h.api || {};
  const services = h.services || [];
  const q = h.queues || {};
  const sec = h.security || {};
  const err = h.errors || {};
  const act = h.activity || {};
  const alerts = h.alerts || [];
  const charts = h.charts || [];
  const healthLogs = h.logs || [];

  const overall = String(h.overallStatus || h.status || "unknown").toLowerCase();
  const statusLabel = h.overallStatus || String(h.status || "unknown").toUpperCase();

  const chartByKey = (key) => {
    const chart = charts.find((c) => c.key === key);
    return chart?.points || [];
  };

  const totalLogElements = logs?.totalElements ?? 0;
  const totalLogPages = totalLogElements > 0 ? Math.ceil(totalLogElements / 30) : 0;
  // Only fall back to the embedded (unfiltered) payload logs on the initial
  // load before the log endpoint responds — never mask filtered-empty results.
  const displayedLogs = logs === null ? healthLogs : (logs?.content || []);

  return (
    <section className="admin-page">
      {/* ── Hero + global status ── */}
      <HeroSection
        className="hero-section--compact"
        badge="Monitoring"
        title="Platform Health"
        subtitle="Real-time system, database, API, queue, security, and error monitoring. All metrics are live backend data."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">monitor_heart</span>
          </div>
        }
      >
        <div className={`ph-status ph-status--${overall}`}>
          <span className="ph-status__dot" /> {statusLabel}
        </div>
        <label className="ph-autorefresh" title="Refresh every 15 seconds">
          <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
          Auto 15s
        </label>
        <button
          type="button"
          className="hero-section__btn hero-section__btn--primary"
          onClick={loadHealth}
        >
          <span className="material-symbols-outlined">refresh</span>
          Refresh
        </button>
      </HeroSection>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="ph-alerts">
          {alerts.map((a, i) => (
            <AlertCard key={i} alert={a} />
          ))}
        </div>
      )}

      {/* ── System metric cards ── */}
      <div className="ph-kpi-grid">
        <AnimatedStat label="Users Online" value={act.usersOnline} icon="person" tone="teal" />
        <AnimatedStat label="Mentors Online" value={act.mentorsOnline} icon="verified" tone="blue" />
        <AnimatedStat label="Learners Online" value={act.learnersOnline} icon="school" tone="teal" />
        <AnimatedStat label="Active Sessions" value={act.activeSessions} icon="video_library" tone="amber" />
        <AnimatedStat label="Registrations Today" value={act.registrationsToday} icon="person_add" tone="green" />
        <AnimatedStat label="Bookings Today" value={act.bookingsToday} icon="calendar_month" tone="cyan" />
        <AnimatedStat label="Logins Today" value={act.loginsToday} icon="login" tone="blue" />
        <AnimatedStat label="Errors Today" value={err.errorsToday} icon="error" tone="red" />
        <AnimatedStat label="Failed Logins (24h)" value={sec.failedLogins24h} icon="lock" tone="orange" />
      </div>

      {/* ── System (JVM) metrics ── */}
      <div className="aa-grid">
        <SectionCard title="System Metrics" icon="memory" headerExtra={
          <span className="admin-count-badge">Uptime {s.uptimeLabel || "—"}</span>
        }>
          <div className="ph-usage-stack">
            <UsageBar value={s.cpuPercent} label="CPU usage" />
            <UsageBar value={s.heapPercent} label="Heap memory" />
            <UsageBar value={s.memoryPercent} label="Total memory" />
            <UsageBar value={s.diskPercent} label="Disk usage" />
          </div>
        </SectionCard>
        <SectionCard title="Environment" icon="dns">
          <div className="ph-info-stack">
            <InfoRow icon="timer" label="Uptime" value={s.uptimeLabel || "—"} />
            <InfoRow icon="trending_up" label="System load" value={Number(s.systemLoadAverage || 0).toFixed(2)} />
            <InfoRow icon="data_object" label="Heap / Max" value={`${formatNumber(s.heapUsedMb)} / ${formatNumber(s.heapMaxMb)} MB`} />
            <InfoRow icon="extension" label="Non-heap" value={`${formatNumber(s.nonHeapMb)} MB`} />
            <InfoRow icon="inventory_2" label="Storage remaining" value={`${formatNumber(s.diskUsableMb)} MB`} />
            <InfoRow icon="lan" label="Network usage" value="—" valueColor="var(--admin-muted)" />
            <InfoRow icon="developer_mode" label="Threads" value={formatNumber(s.threadCount)} />
            <InfoRow icon="code" label="JVM" value={s.jvmVersion || "—"} />
            <InfoRow icon="code" label="Java" value={s.javaVersion || "—"} />
            <InfoRow icon="computer" label="OS" value={s.os || "—"} />
            <InfoRow icon="schedule" label="Timezone" value={s.timezone || "—"} />
            <InfoRow icon="history" label="Server time" value={formatDate(s.serverTime || h.serverTime)} />
            <InfoRow icon="tag" label="App version" value={s.appVersion || "dev"} />
          </div>
        </SectionCard>
      </div>

      {/* ── Database health + API monitoring ── */}
      <div className="aa-grid">
        <SectionCard title="Database Health" icon="storage" headerExtra={<StatusPill status={db.status} />}>
          <div className="ph-usage-stack">
            <UsageBar value={db.poolUsagePercent} label="Connection pool usage" />
          </div>
          <div className="ph-info-stack">
            <InfoRow icon="timer" label="Response time" value={`${db.responseTimeMs ?? "—"} ms`} />
            <InfoRow icon="power" label="Active connections" value={formatNumber(db.activeConnections)} />
            <InfoRow icon="power_off" label="Idle connections" value={formatNumber(db.idleConnections)} />
            <InfoRow icon="swap_vert" label="Waiting threads" value={formatNumber(db.waitingConnections)} />
            <InfoRow icon="tune" label="Pool max" value={formatNumber(db.poolMax)} />
            <InfoRow icon="speed" label="Slow queries" value={formatNumber(db.slowQueries)} />
            <InfoRow icon="link_off" label="Connection errors" value={formatNumber(db.connectionErrors)} />
            <InfoRow icon="data_usage" label="Database size" value={`${formatNumber(db.dbSizeMb)} MB`} />
            <InfoRow icon="memory" label="Driver" value={db.driver || "—"} />
          </div>
        </SectionCard>
        <SectionCard title="API Monitoring" icon="api" headerExtra={
          <span className="admin-count-badge">{api.totalApis || 0} endpoints</span>
        }>
          <div className="ph-usage-stack">
            <UsageBar value={api.successRate} label="Success rate" suffix="%" />
          </div>
          <div className="ph-info-stack">
            <InfoRow icon="swap_calls" label="Total requests" value={formatNumber(api.totalRequests)} />
            <InfoRow icon="error" label="Failed requests" value={formatNumber(api.failedRequests)} />
            <InfoRow icon="timelapse" label="Avg response" value={`${api.avgResponseTimeMs ?? "—"} ms`} />
            <InfoRow icon="slow_motion_video" label="Slowest endpoint" value={api.slowestEndpoint || "—"} />
            <InfoRow icon="query_stats" label="Slowest avg" value={`${api.slowestEndpointMs ?? "—"} ms`} />
            <InfoRow icon="leaderboard" label="Most requested" value={api.mostRequestedEndpoint || "—"} />
            <InfoRow icon="traffic" label="Requests (top)" value={formatNumber(api.mostRequestedCount)} />
            <InfoRow icon="today" label="Failed today" value={formatNumber(api.failedToday)} />
          </div>
        </SectionCard>
      </div>

      {/* ── Microservices + Queues ── */}
      <div className="aa-grid">
        <SectionCard title="Services" icon="hub" headerExtra={
          <span className="admin-count-badge">{services.length} services</span>
        }>
          <div className="ph-services">
            {services.length > 0 ? (
              services.map((svc, i) => <ServiceRow key={svc.name + i} service={svc} />)
            ) : (
              <div className="admin-empty-state"><Icon name="hub" /><p>No service data yet.</p></div>
            )}
          </div>
        </SectionCard>
        <SectionCard title="Queues & Jobs" icon="queue">
          <div className="ph-info-stack">
            <InfoRow icon="notifications" label="Notification queue (unread)" value={formatNumber(q.notificationQueue)} />
            <InfoRow icon="mail" label="Email queue (24h)" value={formatNumber(q.emailQueue)} />
            <InfoRow icon="pending_actions" label="Background jobs (pending)" value={formatNumber(q.backgroundJobs)} />
            <InfoRow icon="replay" label="Retry queue (locked)" value={formatNumber(q.retryQueue)} />
            <InfoRow icon="error_outline" label="Failed jobs (24h)" value={formatNumber(q.failedJobs)} />
            <InfoRow icon="hourglass_bottom" label="Pending jobs" value={formatNumber(q.pendingJobs)} />
          </div>
        </SectionCard>
      </div>

      {/* ── Security + Errors ── */}
      <div className="aa-grid">
        <SectionCard title="Security Monitoring" icon="security" headerExtra={
          <span className="admin-count-badge">{formatNumber(sec.securityEvents24h)} events (24h)</span>
        }>
          <div className="ph-info-stack">
            <InfoRow icon="lock" label="Failed logins (24h)" value={formatNumber(sec.failedLogins24h)} />
            <InfoRow icon="block" label="Blocked users" value={formatNumber(sec.blockedUsers)} />
            <InfoRow icon="gpp_maybe" label="Suspicious requests (24h)" value={formatNumber(sec.suspiciousRequests24h)} />
            <InfoRow icon="verified_user" label="JWT validation errors (24h)" value={formatNumber(sec.jwtValidationErrors24h)} />
            <InfoRow icon="no_encryption" label="Unauthorized requests (24h)" value={formatNumber(sec.unauthorizedRequests24h)} />
          </div>
        </SectionCard>
        <SectionCard title="Error Monitoring" icon="bug_report" headerExtra={
          <span className="admin-count-badge">{formatNumber(err.errorsToday)} today</span>
        }>
          <div className="ph-info-stack">
            <InfoRow icon="error" label="Errors today" value={formatNumber(err.errorsToday)} />
            <InfoRow icon="report" label="Critical (24h)" value={formatNumber(err.criticalErrors24h)} />
            <InfoRow icon="warning" label="Warnings (24h)" value={formatNumber(err.warnings24h)} />
            <InfoRow icon="splitscreen" label="Exceptions (24h)" value={formatNumber(err.exceptions24h)} />
          </div>
          {err.recentStackTraces?.length > 0 && (
            <div className="ph-stacktraces">
              <strong style={{ fontSize: "0.8rem", marginBottom: 6, display: "block", color: "var(--admin-muted)" }}>
                Recent error traces
              </strong>
              {err.recentStackTraces.map((st, i) => (
                <div key={i} className="ph-stacktrace" title={st.message}>
                  {st.message}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Charts ── */}
      <div className="admin-section-divider">
        <span className="admin-section-divider__line" />
        <span className="admin-section-divider__label"><Icon name="monitoring" /> Live Charts</span>
        <span className="admin-section-divider__line" />
      </div>

      <div className="aa-grid">
        <SectionCard title="CPU Usage (%)" icon="memory">
          {chartByKey("cpu").length > 0 ? (
            <TrendChart data={chartByKey("cpu")} type="area" height={170} gradientId="phCpu" valueFormatter={(v) => `${v}%`} />
          ) : (
            <div className="admin-empty-state"><Icon name="memory" /><p>Sampling CPU… keep auto-refresh on.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Heap Memory (%)" icon="data_object">
          {chartByKey("memory").length > 0 ? (
            <TrendChart data={chartByKey("memory")} type="area" height={170} gradientId="phMem" valueFormatter={(v) => `${v}%`} />
          ) : (
            <div className="admin-empty-state"><Icon name="data_object" /><p>Sampling memory… keep auto-refresh on.</p></div>
          )}
        </SectionCard>
      </div>

      <div className="aa-grid">
        <SectionCard title="API Response (ms)" icon="timelapse">
          {chartByKey("apiResponse").length > 0 ? (
            <TrendChart data={chartByKey("apiResponse")} type="area" height={170} gradientId="phApi" valueFormatter={(v) => `${v} ms`} />
          ) : (
            <div className="admin-empty-state"><Icon name="timelapse" /><p>Sampling API latency…</p></div>
          )}
        </SectionCard>
        <SectionCard title="Database Response (ms)" icon="storage">
          {chartByKey("dbResponse").length > 0 ? (
            <TrendChart data={chartByKey("dbResponse")} type="bar" height={170} valueFormatter={(v) => `${v} ms`} />
          ) : (
            <div className="admin-empty-state"><Icon name="storage" /><p>Sampling DB latency…</p></div>
          )}
        </SectionCard>
      </div>

      <div className="aa-grid">
        <SectionCard title="System Load" icon="trending_up">
          {chartByKey("systemLoad").length > 0 ? (
            <TrendChart data={chartByKey("systemLoad")} type="bar" height={170} valueFormatter={(v) => Number(v).toFixed(2)} />
          ) : (
            <div className="admin-empty-state"><Icon name="trending_up" /><p>Sampling system load…</p></div>
          )}
        </SectionCard>
        <SectionCard title="Daily Signups (14d)" icon="person_add">
          {chartByKey("userActivity").length > 0 ? (
            <TrendChart data={chartByKey("userActivity")} type="bar" height={170} valueFormatter={(v) => `${v} signups`} />
          ) : (
            <div className="admin-empty-state"><Icon name="person_add" /><p>No signup data yet.</p></div>
          )}
        </SectionCard>
      </div>

      {err.trend?.length > 0 && err.trend.some((t) => t.points?.length > 0) && (
        <div className="aa-grid">
          {err.trend.map((t, i) => (
            <SectionCard key={i} title={t.label || "Error Trend"} icon="bug_report">
              <TrendChart data={t.points} type="bar" height={170} valueFormatter={(v) => `${v} errors`} />
            </SectionCard>
          ))}
        </div>
      )}

      {/* ── Log viewer ── */}
      <div className="admin-section-divider">
        <span className="admin-section-divider__line" />
        <span className="admin-section-divider__label"><Icon name="article" /> Recent Logs</span>
        <span className="admin-section-divider__line" />
      </div>

      <div className="admin-panel">
        <div className="ph-log-toolbar">
          <div className="ph-log-toolbar__left">
            {LEVELS.map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`ph-log-level${logLevel === lvl ? " is-active" : ""} ph-log-level--${lvl.toLowerCase()}`}
                onClick={() => { setLogLevel(logLevel === lvl ? "" : lvl); setLogPage(0); }}
              >
                {lvl}
              </button>
            ))}
          </div>
          <div className="ph-log-toolbar__right">
            <input
              type="search"
              className="ph-log-search"
              placeholder="Search logs…"
              value={logQuery}
              onChange={(e) => { setLogQuery(e.target.value); setLogPage(0); }}
              aria-label="Search logs"
            />
            <button type="button" className="admin-refresh-btn" onClick={loadLogs} disabled={logsLoading}>
              <Icon name="refresh" /> {logsLoading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </div>

        {logsLoading && !displayedLogs?.length ? (
          <div className="ph-skeleton ph-skeleton--logs">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="ph-skeleton__row" />
            ))}
          </div>
        ) : displayedLogs?.length > 0 ? (
          <div className="ph-log-list">
            {displayedLogs.map((entry, i) => (
              <LogRow key={i} entry={entry} />
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">
            <Icon name="article" />
            <p>No logs captured yet. Logs appear here as the application runs.</p>
          </div>
        )}

        {totalLogPages > 1 && (
          <div className="ph-log-pager">
            <button
              type="button"
              className="admin-refresh-btn"
              disabled={logPage === 0}
              onClick={() => setLogPage((p) => Math.max(0, p - 1))}
            >
              <Icon name="chevron_left" /> Prev
            </button>
            <span>Page {logPage + 1} of {totalLogPages}</span>
            <button
              type="button"
              className="admin-refresh-btn"
              disabled={logPage + 1 >= totalLogPages}
              onClick={() => setLogPage((p) => p + 1)}
            >
              Next <Icon name="chevron_right" />
            </button>
          </div>
        )}
      </div>

      {/* ── Export ── */}
      <div className="admin-panel" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="auto_awesome" />
          <span style={{ fontWeight: 700, color: "var(--admin-text)" }}>Export Monitoring Report</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="admin-refresh-btn" onClick={handleExportCsv} disabled={exporting.csv} style={{ background: "#059669" }}>
            <Icon name="table_chart" /> {exporting.csv ? "Exporting…" : "Export CSV"}
          </button>
          <button type="button" className="admin-refresh-btn" onClick={handleExportXlsx} disabled={exporting.xlsx} style={{ background: "#1d4ed8" }}>
            <Icon name="grid_on" /> {exporting.xlsx ? "Exporting…" : "Export Excel"}
          </button>
          <button type="button" className="admin-refresh-btn" onClick={handleExportPdf} disabled={exporting.pdf} style={{ background: "#b91c1c" }}>
            <Icon name="picture_as_pdf" /> {exporting.pdf ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* ── Summary cards (real DB counts) ── */}
      <div className="ph-footer-stats">
        <StatsCard icon="people" label="Total Users" value={formatNumber(h.totalUsers)} description="Registered accounts" />
        <StatsCard icon="calendar_month" label="Total Bookings" value={formatNumber(h.totalBookings)} description="All bookings" />
        <StatsCard icon="flag" label="Pending Reports" value={formatNumber(h.pendingReports)} description="Open reports" />
        <StatsCard icon="article" label="Captured Logs" value={formatNumber(h.totalLogs)} description="In the live log buffer" />
      </div>
    </section>
  );
}
