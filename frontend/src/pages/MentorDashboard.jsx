import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import DashboardMetricCard from "../components/dashboard/DashboardMetricCard";
import DashboardSection from "../components/dashboard/DashboardSection";
import EmptyStateCard from "../components/dashboard/EmptyStateCard";
import { SkeletonDashboard } from "../components/SkeletonLoaders";
import "./dashboard.css";

export default function MentorDashboard({ profile }) {
  const firstName =
    String(profile?.fullName || "Mentor")
      .trim()
      .split(" ")[0] || "Mentor";
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [analytics, setAnalytics] = useState({
    acceptanceRate: 0,
    repeatLearnerRate: 0,
    avgRevenuePerSession: 0,
    monthGrowth: 0,
  });
  const [monthlyRevenue, setMonthlyRevenue] = useState([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    completedSessions: 0,
    totalEarnings: 0,
    averageRating: 0,
    totalReviews: 0,
  });

  useEffect(() => {
    loadMentorData();
  }, []);

  const loadMentorData = async () => {
    try {
      setLoading(true);
      await client.post("/api/v1/certifications/evaluate").catch(() => null);
      const [
        sessionsRes,
        bookingsRes,
        reviewsRes,
        verificationRes,
        certificationsRes,
      ] = await Promise.all([
        client.get("/api/v1/sessions"),
        client.get("/api/v1/bookings"),
        client.get("/api/v1/reviews/mentor"),
        client
          .get("/api/v1/verification/mentor/status")
          .catch(() => ({ data: { data: null } })),
        profile?.id
          ? client
              .get(`/api/mentor/certifications/${profile.id}`)
              .catch(() => ({ data: { data: [] } }))
          : Promise.resolve({ data: { data: [] } }),
      ]);

      const allSessions = sessionsRes?.data?.data || [];
      const allBookings = bookingsRes?.data?.data || [];
      const allReviews = reviewsRes?.data?.data || [];

      const sortedUpcoming = allSessions
        .filter((s) => new Date(s?.startTime || 0) > new Date())
        .sort(
          (a, b) =>
            new Date(a?.startTime || 0).getTime() -
            new Date(b?.startTime || 0).getTime(),
        );

      const pending = allBookings.filter(
        (b) => (b?.bookingStatus || b?.status) === "PENDING",
      );
      const completedBookings = allBookings.filter(
        (b) => (b?.bookingStatus || b?.status) === "COMPLETED",
      );
      const totalEarnings = completedBookings.reduce(
        (sum, b) => sum + Number(b?.payment?.amount || 0),
        0,
      );
      const averageRating =
        allReviews.length > 0
          ? Number(
              (
                allReviews.reduce((sum, r) => sum + Number(r?.rating || 0), 0) /
                allReviews.length
              ).toFixed(1),
            )
          : 0;

      const nonPending = allBookings.filter(
        (b) => (b?.bookingStatus || b?.status) !== "PENDING",
      ).length;
      const accepted = allBookings.filter((b) =>
        ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(
          b?.bookingStatus || b?.status,
        ),
      ).length;
      const acceptanceRate =
        nonPending > 0 ? Math.round((accepted / nonPending) * 100) : 0;

      const learnerFrequency = {};
      completedBookings.forEach((b) => {
        const lid = b?.learner?.id;
        if (!lid) return;
        learnerFrequency[lid] = (learnerFrequency[lid] || 0) + 1;
      });
      const distinctLearners = Object.keys(learnerFrequency).length;
      const repeatLearners = Object.values(learnerFrequency).filter(
        (c) => c > 1,
      ).length;
      const repeatLearnerRate =
        distinctLearners > 0
          ? Math.round((repeatLearners / distinctLearners) * 100)
          : 0;
      const avgRevenuePerSession =
        completedBookings.length > 0
          ? Number((totalEarnings / completedBookings.length).toFixed(2))
          : 0;

      const months = [];
      const now = new Date();
      for (let i = 5; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
          label: date.toLocaleString(undefined, { month: "short" }),
          value: 0,
        });
      }
      completedBookings.forEach((b) => {
        const paidAt = b?.session?.startTime
          ? new Date(b.session.startTime)
          : null;
        if (!paidAt || Number.isNaN(paidAt.getTime())) return;
        const key = `${paidAt.getFullYear()}-${String(paidAt.getMonth() + 1).padStart(2, "0")}`;
        const monthItem = months.find((m) => m.key === key);
        if (monthItem) monthItem.value += Number(b?.payment?.amount || 0);
      });

      const prevMonth = months[months.length - 2]?.value || 0;
      const currentMonth = months[months.length - 1]?.value || 0;
      const monthGrowth =
        prevMonth > 0
          ? Math.round(((currentMonth - prevMonth) / prevMonth) * 100)
          : currentMonth > 0
            ? 100
            : 0;

      setSessions(allSessions);
      setBookings(allBookings);
      setUpcomingSessions(sortedUpcoming);
      setPendingBookings(pending);
      setReviews(allReviews);
      setCertifications(certificationsRes?.data?.data || []);
      setVerificationStatus(verificationRes?.data?.data || null);
      setAnalytics({
        acceptanceRate,
        repeatLearnerRate,
        avgRevenuePerSession,
        monthGrowth,
      });
      setMonthlyRevenue(months);
      setStats({
        totalSessions: allSessions.length,
        completedSessions: completedBookings.length,
        totalEarnings: Number(totalEarnings.toFixed(2)),
        averageRating,
        totalReviews: allReviews.length,
      });
    } catch (error) {
      console.error("Error loading mentor data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookingStatus = async (bookingId, status) => {
    try {
      await client.patch(`/api/v1/bookings/${bookingId}/status`, { status });
      await loadMentorData();
    } catch (error) {
      console.error("Error updating booking status:", error);
    }
  };

  if (loading) {
    return (
      <main
        style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 20px" }}
      >
        <SkeletonDashboard />
      </main>
    );
  }

  const nextUpcomingSession = upcomingSessions[0] || null;
  const completionPercent =
    stats.totalSessions > 0
      ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
      : 0;
  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.value), 1);

  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "100px 20px 32px",
      }}
    >
      {/* ── Hero Banner ── */}
      <div className="dash-hero dash-hero-mentor">
        <div
          className="dash-hero-orb"
          style={{
            width: 320,
            height: 320,
            top: -120,
            right: -80,
            background: "rgba(167,139,250,0.18)",
          }}
        />
        <div
          className="dash-hero-orb"
          style={{
            width: 260,
            height: 260,
            bottom: -100,
            left: -60,
            background: "rgba(52,211,153,0.15)",
          }}
        />
        <div className="dash-hero-inner">
          <div>
            <p className="dash-hero-eyebrow">Mentor Control Room</p>
            <h1 className="dash-hero-title">Welcome back, {firstName} 👋</h1>
            <p className="dash-hero-sub">
              Manage sessions, respond to requests, and grow your teaching
              reputation — all from one workspace.
            </p>
            <div className="dash-hero-actions">
              <Link to="/teach?tab=sessions" className="dash-hero-btn-primary">
                + Create Session
              </Link>
              <Link to="/teach?tab=packages" className="dash-hero-btn-ghost">
                Manage Packages
              </Link>
              <Link to="/messages" className="dash-hero-btn-ghost">
                Messages
              </Link>
            </div>
          </div>
          <div className="dash-hero-stats">
            <div className="dash-hero-stat">
              <p className="dash-hero-stat-label">Next Session</p>
              <p
                className="dash-hero-stat-value"
                style={{ fontSize: "0.95rem", fontWeight: 700 }}
              >
                {nextUpcomingSession
                  ? nextUpcomingSession.title || "Upcoming"
                  : "None scheduled"}
              </p>
              <p className="dash-hero-stat-desc">
                {nextUpcomingSession
                  ? new Date(nextUpcomingSession.startTime).toLocaleString()
                  : "Create your next slot"}
              </p>
            </div>
            <div className="dash-hero-stat">
              <p className="dash-hero-stat-label">Pending Requests</p>
              <p className="dash-hero-stat-value">{pendingBookings.length}</p>
              <p className="dash-hero-stat-desc">Awaiting your response</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Verification Banner ── */}
      {!verificationStatus?.mentorVerified && (
        <div className="dash-verify-banner">
          <div className="dash-verify-banner-text">
            <h4>Verification pending</h4>
            <p>
              Complete mentor verification to increase trust and booking
              conversions.
            </p>
          </div>
          <Link
            to="/profile-setup"
            className="dash-verify-banner-btn"
            aria-label="Finish Profile"
          >
            Finish Profile
          </Link>
        </div>
      )}

      {/* ── Metric Cards ── */}
      <div
        className="dash-metric-grid"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}
      >
        <DashboardMetricCard
          label="Total Sessions"
          value={stats.totalSessions}
          tone="primary"
          icon="video_camera_front"
        />
        <DashboardMetricCard
          label="Completed"
          value={stats.completedSessions}
          tone="success"
          icon="task_alt"
        />
        <DashboardMetricCard
          label="Total Earnings"
          value={`₹${stats.totalEarnings}`}
          tone="secondary"
          icon="payments"
        />
        <DashboardMetricCard
          label="Avg Rating"
          value={stats.averageRating}
          tone="warning"
          icon="star"
        />
        <DashboardMetricCard
          label="Reviews"
          value={stats.totalReviews}
          tone="neutral"
          icon="rate_review"
        />
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr)",
            gap: "20px",
          }}
        >
          {/* Pending Bookings */}
          {pendingBookings.length > 0 && (
            <DashboardSection
              title="Pending Booking Requests"
              icon="pending_actions"
              iconTone="warning"
              viewAll="View all"
              viewAllTo="/teach"
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                {pendingBookings.slice(0, 3).map((booking) => (
                  <div key={booking.id} className="dash-booking-card">
                    <div className="dash-booking-header">
                      <div>
                        <p className="dash-booking-name">
                          {booking?.learner?.fullName || "Learner"}
                        </p>
                        <p className="dash-booking-skill">
                          {booking?.session?.skill?.name ||
                            booking?.session?.title ||
                            "Session"}
                        </p>
                      </div>
                      <span className="dash-status-chip dash-status-waiting">
                        Awaiting Response
                      </span>
                    </div>
                    <div className="dash-booking-time">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: "0.95rem" }}
                      >
                        schedule
                      </span>
                      {booking?.session?.startTime
                        ? new Date(booking.session.startTime).toLocaleString()
                        : "TBD"}
                    </div>
                    <div className="dash-booking-actions">
                      <button
                        type="button"
                        className="dash-booking-accept"
                        aria-label="Accept"
                        onClick={() =>
                          handleBookingStatus(booking.id, "ACCEPTED")
                        }
                      >
                        ✓ Accept
                      </button>
                      <button
                        type="button"
                        className="dash-booking-decline"
                        aria-label="Decline"
                        onClick={() =>
                          handleBookingStatus(booking.id, "REJECTED")
                        }
                      >
                        ✕ Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </DashboardSection>
          )}

          {/* Two-column layout for Sessions + Analytics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
            }}
          >
            {/* Upcoming Sessions */}
            <DashboardSection
              title="Upcoming Sessions"
              icon="calendar_today"
              iconTone="primary"
              viewAll="Manage"
              viewAllTo="/teach?tab=sessions"
            >
              {upcomingSessions.length === 0 ? (
                <EmptyStateCard
                  icon="event_available"
                  title="No upcoming sessions"
                  description="Publish your next availability slot so learners can find and book you."
                  actionLabel="Create Session"
                  actionTo="/teach?tab=sessions"
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {upcomingSessions.slice(0, 3).map((session) => (
                    <div key={session.id} className="dash-session-card">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "8px",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              margin: 0,
                              fontWeight: 700,
                              fontSize: "0.9rem",
                              color: "var(--text,#182028)",
                            }}
                          >
                            {session?.skill?.name} — {session?.title}
                          </p>
                          <p
                            style={{
                              margin: "2px 0 0",
                              fontSize: "0.78rem",
                              color: "var(--muted,#334155)",
                            }}
                          >
                            ₹{session?.pricePerHour || 0}/hr
                          </p>
                        </div>
                        <span className="dash-status-chip dash-status-confirmed">
                          {session?.confirmedBookings || 0} Booked
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          fontSize: "0.8rem",
                          color: "var(--muted,#334155)",
                        }}
                      >
                        <span
                          className="material-symbols-outlined"
                          style={{ fontSize: "0.95rem" }}
                        >
                          schedule
                        </span>
                        {session?.startTime
                          ? new Date(session.startTime).toLocaleString()
                          : "TBD"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </DashboardSection>

            {/* Recent Reviews */}
            <DashboardSection
              title="Recent Reviews"
              icon="star_rate"
              iconTone="warning"
              viewAll="All reviews"
              viewAllTo="/wallet"
            >
              {reviews.length === 0 ? (
                <EmptyStateCard
                  icon="reviews"
                  title="No reviews yet"
                  description="Complete sessions to earn reviews from your learners."
                  actionLabel="Create Session"
                  actionTo="/teach?tab=sessions"
                />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {reviews.slice(0, 3).map((review) => (
                    <div
                      key={review.id}
                      style={{
                        borderRadius: "12px",
                        border: "1px solid var(--card-border,#dbe4ea)",
                        padding: "14px",
                        background: "var(--hover-bg,#f8fafc)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: "8px",
                        }}
                      >
                        <p
                          style={{
                            margin: 0,
                            fontWeight: 700,
                            fontSize: "0.88rem",
                            color: "var(--text,#182028)",
                          }}
                        >
                          {review?.learner?.fullName || "Learner"}
                        </p>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {[...Array(5)].map((_, i) => (
                            <span
                              key={i}
                              className="material-symbols-outlined"
                              style={{
                                fontSize: "0.9rem",
                                color:
                                  i < Number(review?.rating || 0)
                                    ? "#d97706"
                                    : "#cbd5e1",
                              }}
                            >
                              star
                            </span>
                          ))}
                        </div>
                      </div>
                      {review?.comment && (
                        <p
                          style={{
                            margin: 0,
                            fontSize: "0.8rem",
                            color: "var(--muted,#334155)",
                            fontStyle: "italic",
                            lineHeight: 1.55,
                          }}
                        >
                          &ldquo;{review.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </DashboardSection>
          </div>

          {/* Analytics */}
          <DashboardSection
            title="Advanced Analytics"
            icon="insights"
            iconTone="secondary"
          >
            <div
              className="dash-analytics-grid"
              style={{ marginBottom: "24px" }}
            >
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Acceptance Rate</p>
                <p className="dash-analytic-value">
                  {analytics.acceptanceRate}%
                </p>
              </div>
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Repeat Learners</p>
                <p className="dash-analytic-value">
                  {analytics.repeatLearnerRate}%
                </p>
              </div>
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Avg Revenue / Session</p>
                <p className="dash-analytic-value">
                  ₹{analytics.avgRevenuePerSession}
                </p>
              </div>
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Monthly Growth</p>
                <p
                  className="dash-analytic-value"
                  style={{
                    color: analytics.monthGrowth >= 0 ? "#16a34a" : "#dc2626",
                  }}
                >
                  {analytics.monthGrowth >= 0 ? "+" : ""}
                  {analytics.monthGrowth}%
                </p>
              </div>
            </div>

            {/* Revenue Bar Chart */}
            <p className="dash-chart-title">6-Month Revenue Trend</p>
            <div className="dash-chart-bars">
              {monthlyRevenue.map((month) => {
                const height = Math.max(
                  6,
                  Math.round((month.value / maxRevenue) * 100),
                );
                return (
                  <div key={month.key} className="dash-chart-col">
                    <span className="dash-chart-val">
                      ₹{Math.round(month.value)}
                    </span>
                    <div
                      className="dash-chart-bar"
                      style={{ height: `${height}%` }}
                      title={`₹${Math.round(month.value)}`}
                    />
                    <span className="dash-chart-label">{month.label}</span>
                  </div>
                );
              })}
            </div>
          </DashboardSection>

          {/* Today Focus */}
          <DashboardSection
            title="Today's Focus"
            icon="task_alt"
            iconTone="primary"
          >
            <div className="dash-focus-grid">
              <div className="dash-focus-card">
                <p className="dash-focus-label">Approve Requests</p>
                <p className="dash-focus-text">
                  Respond quickly to pending bookings to improve conversion and
                  learner trust.
                </p>
                <button
                  type="button"
                  className="dash-focus-link"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  }
                >
                  Review now →
                </button>
              </div>
              <div className="dash-focus-card">
                <p className="dash-focus-label">Publish a New Slot</p>
                <p className="dash-focus-text">
                  Keep your profile active by adding fresh availability in your
                  teaching calendar.
                </p>
                <Link to="/teach?tab=sessions" className="dash-focus-link">
                  Create slot →
                </Link>
              </div>
              <div className="dash-focus-card">
                <p className="dash-focus-label">Nurture Relationships</p>
                <p className="dash-focus-text">
                  Send follow-ups and reminders to learners for better retention
                  and reviews.
                </p>
                <Link to="/messages" className="dash-focus-link">
                  Open messages →
                </Link>
              </div>
            </div>
          </DashboardSection>
        </div>

        {/* ── Sidebar ── */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          {/* Performance */}
          <DashboardSection
            title="Performance"
            icon="trending_up"
            iconTone="success"
          >
            <div className="dash-progress-wrap">
              <div className="dash-progress-track">
                <div
                  className="dash-progress-fill"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="dash-progress-label">{completionPercent}%</span>
            </div>
            <p
              style={{
                fontSize: "0.78rem",
                color: "var(--muted,#334155)",
                margin: "0 0 6px",
              }}
            >
              Session Completion Rate
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--muted,#334155)",
                margin: 0,
              }}
            >
              {sessions.length} sessions · {bookings.length} total bookings
            </p>
          </DashboardSection>

          {/* Certifications */}
          <DashboardSection
            title="Certifications"
            icon="workspace_premium"
            iconTone="secondary"
          >
            {certifications.length === 0 ? (
              <EmptyStateCard
                icon="workspace_premium"
                title="No certifications added yet."
                description="Add your professional certifications from your profile to build learner trust."
                actionLabel="Add Certification"
                actionTo="/professional-profile/certifications"
                tone="secondary"
              />
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {certifications.slice(0, 3).map((cert) => (
                  <div
                    key={cert.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ color: "#047857", fontSize: "1.1rem" }}
                    >
                      check_circle
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <p
                        style={{
                          margin: 0,
                          fontWeight: 700,
                          fontSize: "0.84rem",
                          color: "var(--text,#182028)",
                        }}
                      >
                        {cert.certificationName}
                      </p>
                      {cert.issuingOrganization && (
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: "0.74rem",
                            color: "var(--muted,#334155)",
                          }}
                        >
                          {cert.issuingOrganization}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {certifications.length > 3 && (
                  <Link
                    to="/professional-profile/certifications"
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "#4f46e5",
                      textDecoration: "none",
                    }}
                  >
                    +{certifications.length - 3} More
                  </Link>
                )}
              </div>
            )}
          </DashboardSection>

          {/* Quick Actions */}
          <DashboardSection
            title="Quick Actions"
            icon="bolt"
            iconTone="primary"
          >
            <div className="dash-quick-actions">
              <Link
                to="/teach?tab=sessions"
                className="quick-action-btn quick-action-btn-primary"
              >
                Create Session
              </Link>
              <Link
                to="/teach?tab=packages"
                className="quick-action-btn quick-action-btn-outline"
              >
                Manage Packages
              </Link>
              <Link
                to="/professional-profile"
                className="quick-action-btn quick-action-btn-outline"
              >
                Professional Profile
              </Link>
              
              <Link
                to="/messages"
                className="quick-action-btn quick-action-btn-outline"
              >
                Messages
              </Link>
              <Link
                to="/wallet"
                className="quick-action-btn quick-action-btn-outline"
              >
                Earnings &amp; Withdrawals
              </Link>
            </div>
          </DashboardSection>
        </div>
      </div>
    </main>
  );
}
