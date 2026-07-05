import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import { SkeletonDashboard } from "../components/SkeletonLoaders";
import HeroBanner from "../modules/mentor/components/dashboard/HeroBanner";
import StatsCard from "../modules/common/dashboard/StatsCard";
import PendingRequests from "../modules/mentor/components/dashboard/PendingRequests";
import UpcomingSessions from "../modules/mentor/components/dashboard/UpcomingSessions";
import AnalyticsPanel from "../modules/mentor/components/dashboard/AnalyticsPanel";
import RecentReviews from "../modules/mentor/components/dashboard/RecentReviews";
import StudentList from "../modules/mentor/components/dashboard/StudentList";
import QuickActions from "../modules/mentor/components/dashboard/QuickActions";
import PerformanceCard from "../modules/mentor/components/dashboard/PerformanceCard";
import Icon from "../modules/common/dashboard/Icon";
import { formatMoney } from "../modules/common/dashboard/dashboardUtils";
import "../modules/common/dashboard/dashboard.css";

/** Build the last-6-month bucket scaffold: [{ key, label, value }]. */
function buildMonthBuckets() {
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
  return months;
}

function monthKey(dateLike) {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MentorDashboard({ profile }) {
  const firstName =
    String(profile?.fullName || "Mentor")
      .trim()
      .split(" ")[0] || "Mentor";

  useEffect(() => {
    document.title = `${firstName} · Mentor Dashboard | SkillSwap`;
  }, [firstName]);

  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [recentStudents, setRecentStudents] = useState([]);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [analytics, setAnalytics] = useState({
    acceptanceRate: 0,
    completionRate: 0,
    monthGrowth: 0,
  });
  const [series, setSeries] = useState({
    revenue: [],
    students: [],
    sessions: [],
    rating: [],
  });
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalSessions: 0,
    monthlyEarnings: 0,
    totalEarnings: 0,
    averageRating: 0,
    totalReviews: 0,
    completedSessions: 0,
  });

  useEffect(() => {
    loadMentorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMentorData = async () => {
    try {
      setLoading(true);
      await client.post("/api/v1/certifications/evaluate").catch(() => null);
      const [sessionsRes, bookingsRes, reviewsRes, verificationRes] =
        await Promise.all([
          client.get("/api/v1/sessions"),
          client.get("/api/v1/bookings"),
          client.get("/api/v1/reviews/mentor"),
          client
            .get("/api/v1/verification/mentor/status")
            .catch(() => ({ data: { data: null } })),
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

      const statusOf = (b) => b?.bookingStatus || b?.status;
      const pending = allBookings.filter((b) => statusOf(b) === "PENDING");
      const completedBookings = allBookings.filter(
        (b) => statusOf(b) === "COMPLETED",
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
        (b) => statusOf(b) !== "PENDING",
      ).length;
      const accepted = allBookings.filter((b) =>
        ["ACCEPTED", "CONFIRMED", "COMPLETED"].includes(statusOf(b)),
      ).length;
      const acceptanceRate =
        nonPending > 0 ? Math.round((accepted / nonPending) * 100) : 0;
      const completionRate =
        allBookings.length > 0
          ? Math.round((completedBookings.length / allBookings.length) * 100)
          : 0;

      // ── Derive per-learner student roster (progress = completed/total) ──
      const learnerMap = new Map();
      allBookings.forEach((b) => {
        const l = b?.learner;
        if (!l?.id) return;
        const entry = learnerMap.get(l.id) || {
          id: l.id,
          name: l.fullName || "Learner",
          email: l.email || "",
          skill: b?.session?.skill?.name || b?.session?.title || "",
          total: 0,
          completed: 0,
          last: 0,
        };
        entry.total += 1;
        if (statusOf(b) === "COMPLETED") entry.completed += 1;
        const t = new Date(
          b?.session?.startTime || b?.createdAt || 0,
        ).getTime();
        if (t > entry.last) entry.last = t;
        if (!entry.skill && b?.session?.skill?.name)
          entry.skill = b.session.skill.name;
        learnerMap.set(l.id, entry);
      });
      const students = Array.from(learnerMap.values())
        .map((s) => ({
          ...s,
          progress: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
        }))
        .sort((a, b) => b.last - a.last);

      // ── Trend series (last 6 months) ──
      const revenueBuckets = buildMonthBuckets();
      const sessionBuckets = buildMonthBuckets();
      const ratingBuckets = buildMonthBuckets().map((m) => ({
        ...m,
        sum: 0,
        count: 0,
      }));

      completedBookings.forEach((b) => {
        const key = monthKey(b?.session?.startTime || b?.createdAt);
        const bucket = revenueBuckets.find((m) => m.key === key);
        if (bucket) bucket.value += Number(b?.payment?.amount || 0);
      });
      allSessions.forEach((s) => {
        const key = monthKey(s?.startTime || s?.createdAt);
        const bucket = sessionBuckets.find((m) => m.key === key);
        if (bucket) bucket.value += 1;
      });
      allReviews.forEach((r) => {
        const key = monthKey(r?.createdAt);
        const bucket = ratingBuckets.find((m) => m.key === key);
        if (bucket) {
          bucket.sum += Number(r?.rating || 0);
          bucket.count += 1;
        }
      });
      const ratingSeries = ratingBuckets.map((m) => ({
        key: m.key,
        label: m.label,
        value: m.count > 0 ? Number((m.sum / m.count).toFixed(1)) : 0,
      }));

      // student-growth: cumulative distinct learners by first booking month
      const firstSeen = new Map();
      allBookings.forEach((b) => {
        const lid = b?.learner?.id;
        const key = monthKey(b?.session?.startTime || b?.createdAt);
        if (!lid || !key) return;
        if (!firstSeen.has(lid) || key < firstSeen.get(lid))
          firstSeen.set(lid, key);
      });
      const studentBuckets = buildMonthBuckets();
      let cumulative = 0;
      studentBuckets.forEach((m) => {
        const newThisMonth = Array.from(firstSeen.values()).filter(
          (k) => k === m.key,
        ).length;
        cumulative += newThisMonth;
        m.value = cumulative;
      });

      const prevMonth = revenueBuckets[revenueBuckets.length - 2]?.value || 0;
      const currentMonth =
        revenueBuckets[revenueBuckets.length - 1]?.value || 0;
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
      setRecentStudents(students);
      setVerificationStatus(verificationRes?.data?.data || null);
      setAnalytics({ acceptanceRate, completionRate, monthGrowth });
      setSeries({
        revenue: revenueBuckets,
        students: studentBuckets,
        sessions: sessionBuckets,
        rating: ratingSeries,
      });
      setStats({
        totalStudents: learnerMap.size,
        totalSessions: allSessions.length,
        monthlyEarnings: Number(currentMonth.toFixed(2)),
        totalEarnings: Number(totalEarnings.toFixed(2)),
        averageRating,
        totalReviews: allReviews.length,
        completedSessions: completedBookings.length,
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
      <div className="md">
        <SkeletonDashboard />
      </div>
    );
  }

  const nextUpcomingSession = upcomingSessions[0] || null;

  return (
    <div className="md md-page">
      <HeroBanner
        firstName={firstName}
        nextSession={nextUpcomingSession}
        pendingCount={pendingBookings.length}
        monthGrowth={analytics.monthGrowth}
        acceptanceRate={analytics.acceptanceRate}
        totalReviews={stats.totalReviews}
        monthlyEarnings={stats.monthlyEarnings}
      />

      {!verificationStatus?.mentorVerified && (
        <div className="md-verify md-animate">
          <span className="md-verify__icon">
            <Icon name="verified_user" />
          </span>
          <div className="md-verify__text">
            <h4>Verification pending</h4>
            <p>
              Complete mentor verification to increase trust and booking
              conversions.
            </p>
          </div>
          <Link to="/profile-setup" className="md-btn md-btn--brand md-btn--sm">
            Finish Profile
          </Link>
        </div>
      )}

      {/* ── Statistics cards ── */}
      <div className="md-stats md-animate">
        <StatsCard
          icon="groups"
          label="Total Students"
          value={stats.totalStudents}
          description="Unique learners"
        />
        <StatsCard
          icon="video_camera_front"
          label="Total Sessions"
          value={stats.totalSessions}
          description="Published sessions"
        />
        <StatsCard
          icon="payments"
          label="Monthly Earnings"
          value={formatMoney(stats.monthlyEarnings)}
          delta={analytics.monthGrowth}
          description="vs. last month"
        />
        <StatsCard
          icon="star"
          label="Average Rating"
          value={stats.averageRating}
          description={`${stats.totalReviews} reviews`}
        />
        <StatsCard
          icon="task_alt"
          label="Acceptance Rate"
          value={`${analytics.acceptanceRate}%`}
          description="Requests accepted"
        />
        <StatsCard
          icon="check_circle"
          label="Completion Rate"
          value={`${analytics.completionRate}%`}
          description="Sessions completed"
        />
      </div>

      {pendingBookings.length > 0 && (
        <div className="md-animate">
          <PendingRequests
            requests={pendingBookings}
            onRespond={handleBookingStatus}
          />
        </div>
      )}

      {/* ── Sessions + Analytics ── */}
      <div className="md-grid md-animate">
        <div className="md-col-7">
          <UpcomingSessions sessions={upcomingSessions} />
        </div>
        <div className="md-col-5">
          <PerformanceCard
            percent={analytics.completionRate}
            sessions={sessions.length}
            bookings={bookings.length}
          />
        </div>
      </div>

      <div className="md-animate">
        <AnalyticsPanel series={series} />
      </div>

      {/* ── Students + Reviews ── */}
      <div className="md-grid md-animate">
        <div className="md-col-6">
          <StudentList students={recentStudents} />
        </div>
        <div className="md-col-6">
          <RecentReviews reviews={reviews} />
        </div>
      </div>

      <div className="md-animate">
        <QuickActions />
      </div>
    </div>
  );
}
