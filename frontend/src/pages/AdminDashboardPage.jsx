import { useCallback, useEffect, useState } from "react";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import StatsCard from "../modules/common/dashboard/StatsCard";
import SectionCard from "../modules/common/dashboard/SectionCard";
import TrendChart from "../modules/common/dashboard/TrendChart";
import "./AdminOperationsPage.css";
import "./AdminDashboardPage.css";
import "../modules/admin/ui/admin-ui.css";

const formatNumber = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toLocaleString() : "0";
};

const formatPercent = (value) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? `${n}%` : "0%";
};

const formatCurrency = (value) => {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
};

/**
 * Professional Admin Dashboard at /admin/dashboard.
 *
 * Fetches real backend data from:
 *   - GET /api/v1/admin/dashboard?months=6  → health metrics (incl. pending
 *     mentor verifications) + trends
 *   - GET /api/v1/skills                     → Total Skills
 *
 * Renders seven responsive KPI cards using the shared StatsCard component,
 * plus a trend section. Includes loading skeletons, empty states, and an
 * error state with retry.
 */
export default function AdminDashboardPage({ notify }) {
  const [dashboard, setDashboard] = useState(null);
  const [skillsCount, setSkillsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [dashboardRes, skillsRes] = await Promise.all([
        client.get("/api/v1/admin/dashboard?months=6"),
        client.get("/api/v1/skills"),
      ]);
      const dash = dashboardRes?.data?.data || null;
      setDashboard(dash);
      const skills = skillsRes?.data?.data;
      setSkillsCount(Array.isArray(skills) ? skills.length : 0);
    } catch (err) {
      const status = Number(err?.response?.status || 0);
      setLoadError(
        status >= 500
          ? "The server is having trouble right now. Please try again shortly."
          : "We could not load the dashboard data. Check your connection and try again.",
      );
      notify?.({
        type: "error",
        title: "Dashboard unavailable",
        message: "Could not load admin dashboard data from the backend.",
      });
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const health = dashboard?.health || {};

  const cards = [
    {
      icon: "group",
      label: "Total Users",
      value: formatNumber(health.totalUsers),
      description: `${formatNumber(health.joinedThisWeek)} joined this week`,
    },
    {
      icon: "school",
      label: "Total Mentors",
      value: formatNumber(health.totalMentors),
      description: `${formatPercent(health.mentorRatio)} of all users`,
    },
    {
      icon: "person_search",
      label: "Total Learners",
      value: formatNumber(health.totalLearners),
      description: `${formatNumber(health.activeUsers7d)} active in last 7 days`,
    },
    {
      icon: "workspace_premium",
      label: "Total Skills",
      value: formatNumber(skillsCount),
      description: "Skills in the catalogue",
    },
    {
      icon: "event_available",
      label: "Total Sessions",
      value: formatNumber(health.totalSessions),
      description: "Sessions across the platform",
    },
    {
      icon: "task_alt",
      label: "Completed Bookings",
      value: formatNumber(health.completedSessions),
      description: `${formatNumber(health.totalBookings)} total bookings · ${formatPercent(health.completionRate)} done`,
    },
    {
      icon: "hourglass_top",
      label: "Pending Requests",
      value: formatNumber(health.pendingVerifications),
      description: "Mentor verifications awaiting review",
    },
  ];

  const signupTrend = dashboard?.signupTrend || [];
  const sessionTrend = dashboard?.sessionTrend || [];
  const revenueTrend = dashboard?.revenueTrend || [];
  const hasTrendData =
    signupTrend.some((b) => b?.value > 0) ||
    sessionTrend.some((b) => b?.value > 0) ||
    revenueTrend.some((b) => b?.value > 0);

  // ── Loading state ──
  if (loading) {
    return (
      <main className="admin-page">
        <section className="admin-hero">
          <p className="admin-eyebrow">Overview</p>
          <h1>Admin dashboard</h1>
          <p>Loading platform metrics…</p>
        </section>

        <div className="admin-dash-skeleton-grid" aria-label="Loading dashboard cards">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="admin-dash-skeleton-card">
              <div className="admin-dash-skeleton-line admin-dash-skeleton-line--sm" />
              <div className="admin-dash-skeleton-line admin-dash-skeleton-line--lg" />
              <div className="admin-dash-skeleton-line" />
            </div>
          ))}
        </div>
      </main>
    );
  }

  // ── Error state ──
  if (loadError && !dashboard) {
    return (
      <main className="admin-page">
        <section className="admin-hero">
          <p className="admin-eyebrow">Overview</p>
          <h1>Admin dashboard</h1>
          <p>Platform metrics at a glance.</p>
        </section>

        <div className="admin-dash-state" role="alert">
          <span className="admin-dash-state__icon">
            <Icon name="error_outline" />
          </span>
          <h3>Dashboard unavailable</h3>
          <p>{loadError}</p>
          <button type="button" className="admin-dash-retry" onClick={loadAll}>
            Try again
          </button>
        </div>
      </main>
    );
  }

  // ── Empty state (no real data yet) ──
  const hasAnyData = Object.values(health).some(
    (v) => Number(v ?? 0) > 0,
  );

  return (
    <main className="admin-page">
      <section className="admin-hero admin-dash-hero">
        <div>
          <p className="admin-eyebrow">Overview</p>
          <h1>Admin dashboard</h1>
          <p>
            Track users, mentors, skills, sessions, and pending work across the
            platform in real time.
          </p>
        </div>
        <div className="admin-dash-hero-actions">
          <button
            type="button"
            className="admin-refresh-btn"
            onClick={loadAll}
            disabled={loading}
          >
            <Icon name="refresh" /> {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {!hasAnyData && skillsCount === 0 && Number(health.pendingVerifications ?? 0) === 0 ? (
        <div className="admin-dash-state">
          <span className="admin-dash-state__icon">
            <Icon name="dashboard" />
          </span>
          <h3>No platform data yet</h3>
          <p>
            Once learners, mentors, and sessions start flowing through
            SkillSwap, your key metrics will appear here.
          </p>
          <button type="button" className="admin-dash-retry" onClick={loadAll}>
            Refresh now
          </button>
        </div>
      ) : (
        <>
          <div className="admin-dash-stats" aria-label="Key platform metrics">
            {cards.map((card) => (
              <StatsCard
                key={card.label}
                icon={card.icon}
                label={card.label}
                value={card.value}
                description={card.description}
              />
            ))}
          </div>

          {hasTrendData ? (
            <div className="admin-dash-trends">
              <SectionCard title="Signups (6 months)" icon="person_add" action="View Users" actionTo="/admin/users">
                {signupTrend.length > 0 ? (
                  <TrendChart
                    data={signupTrend}
                    type="bar"
                    height={180}
                    valueFormatter={(v) => `${formatNumber(v)} users`}
                  />
                ) : (
                  <p className="muted">No signup trend data available yet.</p>
                )}
              </SectionCard>
              <SectionCard title="Sessions (6 months)" icon="event_available" action="View Sessions" actionTo="/admin/sessions">
                {sessionTrend.length > 0 ? (
                  <TrendChart
                    data={sessionTrend}
                    type="bar"
                    height={180}
                    gradientId="adminSessionArea"
                    valueFormatter={(v) => `${formatNumber(v)} sessions`}
                  />
                ) : (
                  <p className="muted">No session trend data available yet.</p>
                )}
              </SectionCard>
            </div>
          ) : (
            <div className="admin-dash-state">
              <span className="admin-dash-state__icon">
                <Icon name="insights" />
              </span>
              <h3>Trends are warming up</h3>
              <p>
                Monthly signup and session trends will appear here as activity
                accumulates on the platform.
              </p>
            </div>
          )}

          {revenueTrend.some((b) => b?.value > 0) && (
            <div className="admin-panel" style={{ marginTop: 18 }}>
              <div className="admin-section-heading">
                <div>
                  <p className="admin-eyebrow">Finance</p>
                  <h2>Revenue trend (6 months)</h2>
                </div>
                <span className="admin-count-badge">
                  {formatCurrency(revenueTrend[revenueTrend.length - 1]?.value)}
                </span>
              </div>
              <TrendChart
                data={revenueTrend}
                type="area"
                height={160}
                gradientId="adminRevenueArea"
                valueFormatter={(v) => formatCurrency(v)}
              />
            </div>
          )}
        </>
      )}
    </main>
  );
}
