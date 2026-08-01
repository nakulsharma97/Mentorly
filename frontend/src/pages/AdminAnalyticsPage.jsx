import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import StatsCard from "../modules/common/dashboard/StatsCard";
import SectionCard from "../modules/common/dashboard/SectionCard";
import TrendChart from "../modules/common/dashboard/TrendChart";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "jspdf-autotable";
import "./AdminOperationsPage.css";
import "./AdminAnalyticsPage.css";

/* ── Range presets (mapped to the backend `days` window) ─────────── */
const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "3m", label: "3 months", days: 90 },
  { key: "1y", label: "1 year", days: 365 },
];

const formatCurrency = (v) => {
  const n = Number(v || 0);
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
};

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
  }).format(d);
};

const errorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.data?.error || err?.message || fallback;

/* ── Animated number (count-up) ─────────────────────────────────── */
function useCountUp(target, duration = 850) {
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

function AnimatedStat({ label, value, icon, tone = "slate", formatter = formatNumber }) {
  const animated = useCountUp(value);
  return (
    <div className={`ana-stat ana-stat--${tone}`}>
      <span className="ana-stat__icon"><Icon name={icon} /></span>
      <div className="ana-stat__body">
        <p className="ana-stat__value">{formatter(animated)}</p>
        <p className="ana-stat__label">{label}</p>
      </div>
    </div>
  );
}

/* ── Horizontal ranked bars (Top skills / mentors / learners) ────── */
function RankedBars({ items, empty, emptyIcon, suffix }) {
  if (!items || items.length === 0) {
    return (
      <div className="admin-empty-state">
        <Icon name={emptyIcon} />
        <p>{empty}</p>
      </div>
    );
  }
  const max = Math.max(...items.map((it) => Number(it.count) || Number(it.bookingCount) || 0), 1);
  return (
    <div className="ana-ranked">
      {items.map((it, idx) => {
        const count = Number(it.count ?? it.bookingCount) || 0;
        const name = it.name || it.label;
        const sub = it.username ? `@${it.username}` : null;
        const pct = Math.max(4, Math.round((count / max) * 100));
        return (
          <div className="ana-ranked__row" key={it.mentorId ?? it.learnerId ?? it.name ?? idx}>
            <span className="ana-ranked__rank">
              <span className={idx < 3 ? `ana-ranked__medal ana-ranked__medal--${idx + 1}` : ""}>{idx + 1}</span>
            </span>
            <div className="ana-ranked__main">
              <div className="ana-ranked__top">
                <span className="ana-ranked__name" title={name}>{name}</span>
                <span className="ana-ranked__count">{formatNumber(count)} {suffix}</span>
              </div>
              <div className="ana-ranked__track">
                <div className="ana-ranked__fill" style={{ width: `${pct}%` }} />
              </div>
              {sub && <span className="ana-ranked__sub">{sub}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Donut chart (distributions) ────────────────────────────────── */
function Donut({ data, totalLabel }) {
  const total = (data || []).reduce((s, d) => s + (Number(d.count) || 0), 0);
  const palette = ["#0d9488", "#2563eb", "#f59e0b", "#dc2626", "#7c3aed", "#64748b", "#059669", "#ea580c"];
  if (total <= 0) {
    return (
      <div className="ana-donut__empty">
        <Icon name="pie_chart" />
        <p>No data yet.</p>
      </div>
    );
  }
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="ana-donut">
      <svg viewBox="0 0 140 140" role="img" aria-label={totalLabel}>
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
        {(data || []).map((d, i) => {
          const frac = (Number(d.count) || 0) / total;
          const dash = frac * circumference;
          const el = (
            <circle
              key={d.name + i}
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke={palette[i % palette.length]}
              strokeWidth="18"
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              strokeLinecap="butt"
            />
          );
          offset += dash;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" className="ana-donut__total">{formatNumber(total)}</text>
        <text x="70" y="82" textAnchor="middle" className="ana-donut__label">{totalLabel}</text>
      </svg>
      <ul className="ana-legend">
        {(data || []).map((d, i) => (
          <li key={d.name + i}>
            <span className="ana-legend__dot" style={{ background: palette[i % palette.length] }} />
            <span className="ana-legend__name">{d.name.replaceAll("_", " ")}</span>
            <span className="ana-legend__count">{formatNumber(d.count)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Activity heatmap (last N days of signups) ──────────────────── */
function ActivityHeatmap({ data }) {
  const rows = data || [];
  if (rows.length === 0) {
    return (
      <div className="admin-empty-state">
        <Icon name="calendar_view_month" />
        <p>No activity data yet.</p>
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => Number(r.value) || 0), 1);
  const recent = rows.slice(-35); // last 35 days max for readability
  return (
    <div className="ana-heatmap" aria-label="Daily signup activity heatmap">
      {recent.map((r, i) => {
        const v = Number(r.value) || 0;
        const intensity = v === 0 ? 0 : Math.max(1, Math.round((v / max) * 4));
        return (
          <div key={i} className="ana-heatmap__cell-wrap" title={`${r.label}: ${v} signups`}>
            <span className={`ana-heatmap__cell ana-heatmap__cell--${intensity}`} />
            <span className="ana-heatmap__label">{r.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminAnalyticsPage({ notify }) {
  // ── Data state ────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [referralAnalytics, setReferralAnalytics] = useState(null);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState({ csv: false, xlsx: false, pdf: false });

  // ── Filters ──────────────────────────────────────────────────
  const [rangeKey, setRangeKey] = useState("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const listRequestRef = useRef(0);
  const lastErrorRef = useRef("");

  const effectiveDays = useMemo(() => {
    if (rangeKey === "custom") {
      if (!customFrom && !customTo) return 30;
      const from = customFrom ? new Date(customFrom).getTime() : Date.now() - 30 * 86400000;
      const to = customTo ? new Date(customTo).getTime() : Date.now();
      if (Number.isNaN(from) || Number.isNaN(to)) return 30;
      const diff = Math.max(1, Math.round((to - from) / 86400000));
      return Math.min(365, diff);
    }
    return RANGES.find((r) => r.key === rangeKey)?.days || 30;
  }, [rangeKey, customFrom, customTo]);

  // ── Single fetch with stale-response guard (fixes duplicate calls) ──
  const loadDashboard = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await client.get(`/api/v1/admin/dashboard?months=6&days=${effectiveDays}`);
      if (requestId !== listRequestRef.current) return; // stale
      setDashboard(res?.data?.data || null);
    } catch (err) {
      if (requestId !== listRequestRef.current) return;
      const msg = errorMessage(err, "Failed to load dashboard data");
      setError(msg);
      // Only ONE toast per distinct failure — never spam identical errors.
      if (lastErrorRef.current !== msg) {
        lastErrorRef.current = msg;
        notify?.({ type: "error", title: "Dashboard unavailable", message: msg });
      }
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [effectiveDays, notify]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // ── Referral analytics (kept from the existing page) ──────────
  const loadReferralAnalytics = useCallback(async () => {
    try {
      const res = await client.get("/api/v1/admin/referral-analytics");
      setReferralAnalytics(res?.data?.data || null);
    } catch (err) {
      console.warn("Failed to load referral analytics:", err);
    }
  }, []);

  useEffect(() => {
    loadReferralAnalytics();
  }, [loadReferralAnalytics]);

  // ── Auto-refresh (deduped errors — toast only when the message changes) ──
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => loadDashboard(), 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadDashboard]);

  // ── CSV / Excel / PDF export ──────────────────────────────────
  const exportRows = useMemo(() => {
    const h = dashboard?.health || {};
    const rows = [
      ["Admin Analytics Export", new Date().toISOString().slice(0, 10)],
      ["Window", `${effectiveDays} days`],
      [],
      ["Platform Health Metrics"],
      ["Metric", "Value"],
      ["Total Users", h.totalUsers],
      ["Total Mentors", h.totalMentors],
      ["Total Learners", h.totalLearners],
      ["Verified Mentors", h.verifiedMentors],
      ["Pending Verifications", h.pendingVerifications],
      ["Total Skills", h.totalSkills],
      ["Total Sessions", h.totalSessions],
      ["Completed Sessions", h.completedSessions],
      ["Cancelled Sessions", h.cancelledSessions],
      ["Pending Requests", h.pendingRequests],
      ["Active Conversations", h.activeConversations],
      ["Open Reports", h.openReports],
      ["Flagged Content", h.flaggedContent],
      ["Total Payments", h.totalPayments],
      ["Monthly Revenue (window)", h.monthlyRevenue],
      ["Active Users (7d)", h.activeUsers7d],
      ["Joined Today", h.joinedToday],
      ["Joined This Week", h.joinedThisWeek],
      ["Completion Rate (%)", h.completionRate],
      ["Platform Fees", h.platformFees],
      ["Total Released Amount", h.totalReleasedAmount],
      [],
      ["Monthly Trends"],
      ["Month", "Signups", "Revenue", "Completed Bookings", "Reports", "Flagged"],
    ];
    const months = Math.max(
      (dashboard?.signupTrend || []).length,
      (dashboard?.revenueTrend || []).length,
      (dashboard?.sessionTrend || []).length,
      (dashboard?.reportsTrend || []).length,
      (dashboard?.flaggedTrend || []).length,
    );
    for (let i = 0; i < months; i++) {
      rows.push([
        dashboard?.signupTrend?.[i]?.label
          || dashboard?.revenueTrend?.[i]?.label
          || dashboard?.sessionTrend?.[i]?.label
          || dashboard?.reportsTrend?.[i]?.label
          || dashboard?.flaggedTrend?.[i]?.label
          || "",
        dashboard?.signupTrend?.[i]?.value || 0,
        dashboard?.revenueTrend?.[i]?.value || 0,
        dashboard?.sessionTrend?.[i]?.value || 0,
        dashboard?.reportsTrend?.[i]?.value || 0,
        dashboard?.flaggedTrend?.[i]?.value || 0,
      ]);
    }
    return rows;
  }, [dashboard, effectiveDays]);

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = useCallback(() => {
    setExporting((prev) => ({ ...prev, csv: true }));
    try {
      const csv = exportRows
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");
      downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `admin-analytics-${new Date().toISOString().slice(0, 10)}.csv`);
      notify?.({ type: "success", title: "CSV ready", message: "Analytics downloaded as CSV." });
    } catch {
      notify?.({ type: "error", title: "Export failed", message: "Could not generate CSV." });
    } finally {
      setExporting((prev) => ({ ...prev, csv: false }));
    }
  }, [exportRows, notify]);

  const handleExportXlsx = useCallback(async () => {
    setExporting((prev) => ({ ...prev, xlsx: true }));
    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = "SkillSwap";
      workbook.created = new Date();
      const sheet = workbook.addWorksheet("Analytics", { views: [{ state: "frozen", ySplit: 1 }] });
      sheet.addRows(exportRows);
      sheet.columns.forEach((col) => {
        col.width = 26;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(
        new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        `admin-analytics-${new Date().toISOString().slice(0, 10)}.xlsx`,
      );
      notify?.({ type: "success", title: "Excel ready", message: "Analytics downloaded as Excel." });
    } catch {
      notify?.({ type: "error", title: "Export failed", message: "Could not generate Excel file." });
    } finally {
      setExporting((prev) => ({ ...prev, xlsx: false }));
    }
  }, [exportRows, notify]);

  const handleExportPdf = useCallback(() => {
    setExporting((prev) => ({ ...prev, pdf: true }));
    try {
      const h = dashboard?.health || {};
      const doc = new jsPDF({ orientation: "landscape" });
      doc.setFontSize(16);
      doc.text("SkillSwap — Admin Analytics", 14, 16);
      doc.setFontSize(9);
      doc.text(`Generated: ${new Date().toLocaleDateString()} · Window: ${effectiveDays} days`, 14, 24);
      doc.autoTable({
        startY: 30,
        head: [["Metric", "Value"]],
        body: [
          ["Total Users", String(h.totalUsers)],
          ["Mentors", String(h.totalMentors)],
          ["Learners", String(h.totalLearners)],
          ["Verified Mentors", String(h.verifiedMentors)],
          ["Total Sessions", String(h.totalSessions)],
          ["Completed Sessions", String(h.completedSessions)],
          ["Total Payments", String(h.totalPayments)],
          ["Monthly Revenue (window)", `₹${Number(h.monthlyRevenue || 0).toFixed(2)}`],
          ["Active Users (7d)", String(h.activeUsers7d)],
          ["Completion Rate", `${h.completionRate || 0}%`],
          ["Open Reports", String(h.openReports)],
          ["Flagged Content", String(h.flaggedContent)],
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 118, 110] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      const lastY = doc.lastAutoTable?.finalY || 40;
      const trendBody = [];
      const months = Math.max(
        (dashboard?.signupTrend || []).length,
        (dashboard?.sessionTrend || []).length,
        (dashboard?.reportsTrend || []).length,
      );
      for (let i = 0; i < months; i++) {
        trendBody.push([
          dashboard?.signupTrend?.[i]?.label || "",
          String(dashboard?.signupTrend?.[i]?.value || 0),
          String(dashboard?.sessionTrend?.[i]?.value || 0),
          `₹${Number(dashboard?.revenueTrend?.[i]?.value || 0).toFixed(0)}`,
          String(dashboard?.reportsTrend?.[i]?.value || 0),
          String(dashboard?.flaggedTrend?.[i]?.value || 0),
        ]);
      }
      doc.autoTable({
        startY: lastY + 10,
        head: [["Month", "Signups", "Sessions", "Revenue", "Reports", "Flagged"]],
        body: trendBody,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [15, 118, 110] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`admin-analytics-${new Date().toISOString().slice(0, 10)}.pdf`);
      notify?.({ type: "success", title: "PDF ready", message: "Analytics report downloaded as PDF." });
    } catch {
      notify?.({ type: "error", title: "Export failed", message: "Could not generate PDF." });
    } finally {
      setExporting((prev) => ({ ...prev, pdf: false }));
    }
  }, [dashboard, effectiveDays, notify]);

  // ── Loading / error states ────────────────────────────────────
  if (loading && !dashboard) {
    return (
      <section className="admin-page">
        <div className="admin-hero" style={{ marginBottom: 0, borderRadius: "0 0 18px 18px" }}>
          <p className="admin-eyebrow">Analytics</p>
          <h1>Platform Analytics</h1>
          <p>Loading dashboard data…</p>
        </div>
        <div className="ana-skeleton">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="ana-skeleton__card" />
          ))}
        </div>
      </section>
    );
  }

  if (error && !dashboard) {
    return (
      <section className="admin-page">
        <div className="admin-hero" style={{ marginBottom: 0, borderRadius: "0 0 18px 18px" }}>
          <p className="admin-eyebrow">Analytics</p>
          <h1>Platform Analytics</h1>
          <p>Could not load dashboard data. Start the backend and ensure you are signed in as an admin.</p>
          <button type="button" className="admin-refresh-btn" onClick={() => loadDashboard()} style={{ marginTop: 12 }}>
            <Icon name="refresh" /> Retry
          </button>
        </div>
      </section>
    );
  }

  const health = dashboard?.health || {};
  const signupTrend = dashboard?.signupTrend || [];
  const revenueTrend = dashboard?.revenueTrend || [];
  const sessionTrend = dashboard?.sessionTrend || [];
  const completionTrend = dashboard?.completionTrend || [];
  const reportsTrend = dashboard?.reportsTrend || [];
  const flaggedTrend = dashboard?.flaggedTrend || [];
  const dailySignups = dashboard?.dailySignups || [];
  const dailyActive = dashboard?.dailyActive || [];
  const sessionStatusDistribution = dashboard?.sessionStatusDistribution || [];
  const verificationDistribution = dashboard?.verificationDistribution || [];
  const topSkills = dashboard?.topSkills || [];
  const topMentors = dashboard?.topMentors || [];
  const topLearners = dashboard?.topLearners || [];
  const recentActivity = dashboard?.recentActivity || [];
  const platformHealth = dashboard?.platformHealth || {};


  const activityIcon = (type) => {
    switch (type) {
      case "SIGNUP": return "person_add";
      case "COMPLETED": return "check_circle";
      case "PAYMENT": return "payments";
      case "REPORT": return "flag";
      case "FLAGGED": return "shield";
      default: return "admin_panel_settings";
    }
  };

  return (
    <section className="admin-page">
      {/* ── Hero ── */}
      <div className="admin-hero" style={{ marginBottom: 0, borderRadius: "0 0 18px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div>
            <p className="admin-eyebrow">Analytics</p>
            <h1>Platform Analytics</h1>
            <p>Real-time platform metrics, trends, and business intelligence. All values are real database counts.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div className="ana-range">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRangeKey(r.key)}
                  className={`ana-range__btn${rangeKey === r.key ? " is-active" : ""}`}
                >
                  {r.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setRangeKey("custom")}
                className={`ana-range__btn${rangeKey === "custom" ? " is-active" : ""}`}
              >
                Custom
              </button>
            </div>
            {rangeKey === "custom" && (
              <div className="ana-custom-range">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} aria-label="From date" />
                <span>→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} aria-label="To date" />
              </div>
            )}
            <label className="ana-autorefresh" title="Refresh every 30 seconds">
              <input type="checkbox" checked={autoRefresh} onChange={() => setAutoRefresh((v) => !v)} />
              Auto
            </label>
            <button
              type="button"
              className="admin-refresh-btn"
              onClick={() => { loadDashboard(); loadReferralAnalytics(); }}
              style={{ background: "#fff", color: "#0f172a", borderColor: "#fff" }}
            >
              <Icon name="refresh" /> Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI cards (animated counters, real data) ── */}
      <div className="ana-kpi-grid">
        <AnimatedStat label="Total Users" value={health.totalUsers} icon="people" tone="slate" />
        <AnimatedStat label="Total Mentors" value={health.totalMentors} icon="verified" tone="teal" />
        <AnimatedStat label="Total Learners" value={health.totalLearners} icon="school" tone="blue" />
        <AnimatedStat label="Verified Mentors" value={health.verifiedMentors} icon="workspace_premium" tone="green" />
        <AnimatedStat label="Pending Verifications" value={health.pendingVerifications} icon="hourglass_top" tone="amber" />
        <AnimatedStat label="Total Skills" value={health.totalSkills} icon="workspaces" tone="violet" />
        <AnimatedStat label="Total Sessions" value={health.totalSessions} icon="event" tone="cyan" />
        <AnimatedStat label="Completed Sessions" value={health.completedSessions} icon="check_circle" tone="green" />
        <AnimatedStat label="Cancelled Sessions" value={health.cancelledSessions} icon="cancel" tone="rose" />
        <AnimatedStat label="Pending Requests" value={health.pendingRequests} icon="pending_actions" tone="amber" />
        <AnimatedStat label="Active Conversations" value={health.activeConversations} icon="forum" tone="indigo" />
        <AnimatedStat label="Open Reports" value={health.openReports} icon="flag" tone="orange" />
        <AnimatedStat label="Flagged Content" value={health.flaggedContent} icon="shield" tone="red" />
        <AnimatedStat label="Total Payments" value={health.totalPayments} icon="payments" tone="teal" />
        <AnimatedStat label="Revenue (window)" value={health.monthlyRevenue} icon="trending_up" tone="green" formatter={formatCurrency} />
        <AnimatedStat label="New Users Today" value={health.joinedToday} icon="person_add" tone="blue" />
        <AnimatedStat label="Active Users (7d)" value={health.activeUsers7d} icon="group_add" tone="violet" />
      </div>

      {/* ── Row: core trend charts ── */}
      <div className="aa-grid">
        <SectionCard title="Monthly Signups" icon="person_add">
          {signupTrend.length > 0 ? (
            <TrendChart data={signupTrend} type="bar" height={180} valueFormatter={(v) => `${v} users`} />
          ) : (
            <div className="admin-empty-state"><Icon name="person_add" /><p>No signup data yet.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Monthly Sessions" icon="calendar_month">
          {sessionTrend.length > 0 ? (
            <TrendChart data={sessionTrend} type="bar" height={180} valueFormatter={(v) => `${v} sessions`} />
          ) : (
            <div className="admin-empty-state"><Icon name="calendar_month" /><p>No session data yet.</p></div>
          )}
        </SectionCard>
      </div>

      <div className="aa-grid">
        <SectionCard title="Revenue Trend" icon="payments">
          {revenueTrend.length > 0 ? (
            <TrendChart data={revenueTrend} type="area" height={180} gradientId="adminRevenue" valueFormatter={(v) => formatCurrency(v)} />
          ) : (
            <div className="admin-empty-state"><Icon name="payments" /><p>No revenue data yet.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Booking Completion Rate" icon="check_circle" headerExtra={
          <span className="admin-count-badge">{health.completionRate || 0}% overall</span>
        }>
          {completionTrend.length > 0 && completionTrend.some((b) => b?.value > 0) ? (
            <TrendChart data={completionTrend} type="area" height={180} gradientId="adminCompletion" valueFormatter={(v) => `${v}%`} />
          ) : (
            <div className="admin-empty-state"><Icon name="check_circle" /><p>No completed bookings yet.</p></div>
          )}
        </SectionCard>
      </div>

      {/* ── Row: moderation & safety trends ── */}
      <div className="aa-grid">
        <SectionCard title="Reports Trend" icon="flag">
          {reportsTrend.length > 0 && reportsTrend.some((b) => b?.value > 0) ? (
            <TrendChart data={reportsTrend} type="bar" height={180} valueFormatter={(v) => `${v} reports`} />
          ) : (
            <div className="admin-empty-state"><Icon name="flag" /><p>No report data yet.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Flagged Content Trend" icon="shield">
          {flaggedTrend.length > 0 && flaggedTrend.some((b) => b?.value > 0) ? (
            <TrendChart data={flaggedTrend} type="bar" height={180} valueFormatter={(v) => `${v} flagged`} />
          ) : (
            <div className="admin-empty-state"><Icon name="shield" /><p>No flagged content yet.</p></div>
          )}
        </SectionCard>
      </div>

      {/* ── Row: daily activity ── */}
      <div className="aa-grid">
        <SectionCard title="Daily Signups (window)" icon="insights">
          {dailySignups.length > 0 && dailySignups.some((b) => b?.value > 0) ? (
            <TrendChart data={dailySignups} type="bar" height={160} valueFormatter={(v) => `${v} signups`} />
          ) : (
            <div className="admin-empty-state"><Icon name="insights" /><p>No signups in this window.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Daily Active Users (window)" icon="login">
          {dailyActive.length > 0 && dailyActive.some((b) => b?.value > 0) ? (
            <TrendChart data={dailyActive} type="area" height={160} gradientId="adminDailyActive" valueFormatter={(v) => `${v} active`} />
          ) : (
            <div className="admin-empty-state"><Icon name="login" /><p>No activity in this window.</p></div>
          )}
        </SectionCard>
      </div>

      {/* ── Row: distributions ── */}
      <div className="aa-grid">
        <SectionCard title="Session Status Distribution" icon="pie_chart">
          {sessionStatusDistribution.length > 0 ? (
            <Donut data={sessionStatusDistribution} totalLabel="sessions" />
          ) : (
            <div className="admin-empty-state"><Icon name="pie_chart" /><p>No session data yet.</p></div>
          )}
        </SectionCard>
        <SectionCard title="Verification Status Distribution" icon="verified">
          {verificationDistribution.length > 0 ? (
            <Donut data={verificationDistribution} totalLabel="requests" />
          ) : (
            <div className="admin-empty-state"><Icon name="verified" /><p>No verification data yet.</p></div>
          )}
        </SectionCard>
      </div>

      {/* ── Row: rankings ── */}
      <div className="aa-grid">
        <SectionCard title="Top Skills" icon="school" headerExtra={
          <span className="admin-count-badge">Top {topSkills.length || 0}</span>
        }>
          <RankedBars items={topSkills} empty="No skill data yet." emptyIcon="school" suffix="mentions" />
        </SectionCard>
        <SectionCard title="Most Active Mentors" icon="groups" headerExtra={
          <span className="admin-count-badge">Top {topMentors.length || 0}</span>
        }>
          <RankedBars items={topMentors} empty="No mentor activity yet." emptyIcon="groups" suffix="bookings" />
        </SectionCard>
      </div>

      <div className="aa-grid">
        <SectionCard title="Most Active Learners" icon="person" headerExtra={
          <span className="admin-count-badge">Top {topLearners.length || 0}</span>
        }>
          <RankedBars items={topLearners} empty="No learner activity yet." emptyIcon="person" suffix="bookings" />
        </SectionCard>
        <SectionCard title="Signup Activity Heatmap" icon="calendar_view_month" headerExtra={
          <span className="admin-count-badge">{dailySignups.length || 0} days</span>
        }>
          <ActivityHeatmap data={dailySignups} />
        </SectionCard>
      </div>

      {/* ── Row: recent activity + platform health ── */}
      <div className="aa-grid">
        <SectionCard title="Recent Activity" icon="history" headerExtra={
          <span className="admin-count-badge">{recentActivity.length || 0} events</span>
        }>
          {recentActivity.length > 0 ? (
            <ul className="ana-activity">
              {recentActivity.map((ev, i) => (
                <li key={i} className="ana-activity__item">
                  <span className={`ana-activity__icon ana-activity__icon--${(ev.type || "ADMIN").toLowerCase()}`}>
                    <Icon name={activityIcon(ev.type)} />
                  </span>
                  <div className="ana-activity__body">
                    <strong>{ev.title}</strong>
                    {ev.detail && <span className="ana-activity__detail">{ev.detail}</span>}
                    <span className="ana-activity__meta">
                      {ev.actorName ? `${ev.actorName} · ` : ""}{formatDate(ev.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty-state"><Icon name="history" /><p>No recent activity yet.</p></div>
          )}
        </SectionCard>

        <SectionCard title="Platform Health" icon="monitor_heart" headerExtra={
          <span className="admin-count-badge">{platformHealth.apiResponseTimeMs || 0} ms</span>
        }>
          <div className="ana-health">
            <div className="ana-health__row">
              <span><Icon name="dns" /> Backend</span>
              <span className={`ana-health__status ana-health__status--${(platformHealth.backendStatus || "UP").toLowerCase()}`}>
                <span className="ana-health__dot" /> {platformHealth.backendStatus || "UP"}
              </span>
            </div>
            <div className="ana-health__row">
              <span><Icon name="storage" /> Database</span>
              <span className={`ana-health__status ana-health__status--${(platformHealth.databaseStatus || "UP").toLowerCase()}`}>
                <span className="ana-health__dot" /> {platformHealth.databaseStatus || "UP"}
              </span>
            </div>
            <div className="ana-health__row">
              <span><Icon name="timer" /> API response</span>
              <span>{platformHealth.apiResponseTimeMs || 0} ms</span>
            </div>
            <div className="ana-health__row">
              <span><Icon name="memory" /> Storage in use</span>
              <span>{formatNumber(platformHealth.storageUsageMb)} MB</span>
            </div>
            <div className="ana-health__row">
              <span><Icon name="error" /> Errors (24h)</span>
              <span>{formatNumber(platformHealth.errorRate24h)}</span>
            </div>
            <div className="ana-health__row">
              <span><Icon name="notifications" /> Notifications today</span>
              <span>{formatNumber(platformHealth.notificationQueueToday)}</span>
            </div>
            <div className="ana-health__row">
              <span><Icon name="mail" /> Email events (24h)</span>
              <span>{formatNumber(platformHealth.emailQueueToday)}</span>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* ── Quick actions / export ── */}
      <div className="admin-panel" style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="auto_awesome" />
          <span style={{ fontWeight: 700, color: "#0f172a" }}>Export Analytics</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="admin-refresh-btn" onClick={loadDashboard}>
            <Icon name="refresh" /> Refresh
          </button>
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

      {/* ── Referral analytics (kept) ── */}
      {referralAnalytics && (
        <>
          <div className="admin-section-divider">
            <span className="admin-section-divider__line" />
            <span className="admin-section-divider__label"><Icon name="share" /> Referral Analytics</span>
            <span className="admin-section-divider__line" />
          </div>
          <div className="wallet-card-grid">
            <StatsCard icon="group_add" label="Total Referrals" value={formatNumber(referralAnalytics.totalReferrals)} description={`${formatNumber(referralAnalytics.totalReferrers)} unique referrers`} />
            <StatsCard icon="payments" label="Total Credits Earned" value={formatNumber(referralAnalytics.totalCreditsEarned)} description={`${referralAnalytics.avgPerReferrer} avg per referrer`} />
            <StatsCard icon="trending_up" label="Conversion Rate" value={`${referralAnalytics.conversionRate}%`} description="Of all users have referred someone" />
            <StatsCard icon="groups" label="Users with Referral Code" value={formatNumber(referralAnalytics.usersWithReferralCode)} description="Total users who can refer" />
          </div>
          <div className="aa-grid" style={{ marginBottom: 18 }}>
            <SectionCard title="Referral Trend" icon="timeline">
              {referralAnalytics.referralTrend?.length > 0 ? (
                <TrendChart data={referralAnalytics.referralTrend} type="bar" height={180} valueFormatter={(v) => `${v} referrals`} />
              ) : (
                <div className="admin-empty-state"><Icon name="timeline" /><p>No referral data yet.</p></div>
              )}
            </SectionCard>
            <SectionCard title="Top Referrers" icon="leaderboard" headerExtra={
              <span className="admin-count-badge">{referralAnalytics.topReferrers?.length || 0} users</span>
            }>
              {referralAnalytics.topReferrers?.length > 0 ? (
                <RankedBars
                  items={referralAnalytics.topReferrers.map((r) => ({ name: r.name, count: r.referralCount }))}
                  empty="No referrers yet." emptyIcon="group_add" suffix="referrals"
                />
              ) : (
                <div className="admin-empty-state"><Icon name="group_add" /><p>No referrers yet.</p></div>
              )}
            </SectionCard>
          </div>
        </>
      )}
    </section>
  );
}
