import { useEffect, useState } from "react";
import client from "../api/client";
import { SkeletonDashboard } from "../components/SkeletonLoaders";
import StatsCard from "../modules/common/dashboard/StatsCard";
import LearnerHero from "../modules/learner/components/dashboard/LearnerHero";
import LearnerUpcomingSessions from "../modules/learner/components/dashboard/LearnerUpcomingSessions";
import MentorRecommendations from "../modules/learner/components/dashboard/MentorRecommendations";
import ContinueLearning from "../modules/learner/components/dashboard/ContinueLearning";
import LearningProgress from "../modules/learner/components/dashboard/LearningProgress";
import Achievements from "../modules/learner/components/dashboard/Achievements";
import Certificates from "../modules/learner/components/dashboard/Certificates";
import LearningRoadmap from "../modules/learner/components/dashboard/LearningRoadmap";
import "../modules/common/dashboard/dashboard.css";
import "../modules/learner/LearnerDashboard.css";

const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const monthKey = (d) => {
  const date = d ? new Date(d) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

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

/** Longest run of consecutive active days ending at the most recent activity. */
function computeStreak(daySet) {
  if (!daySet.size) return 0;
  const days = [...daySet].sort().reverse();
  let streak = 1;
  let prev = new Date(days[0]);
  for (let i = 1; i < days.length; i += 1) {
    const cur = new Date(days[i]);
    const diff = Math.round((prev - cur) / 86400000);
    if (diff === 1) {
      streak += 1;
      prev = cur;
    } else if (diff === 0) {
      // same day duplicate — ignore
    } else {
      break;
    }
  }
  return streak;
}

export default function LearnerDashboard({ profile }) {
  const firstName =
    String(profile?.fullName || "Learner")
      .trim()
      .split(" ")[0] || "Learner";

  useEffect(() => {
    document.title = `${firstName} · Learner Dashboard | SkillSwap`;
  }, [firstName]);

  const [loading, setLoading] = useState(true);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [recommendedMentors, setRecommendedMentors] = useState([]);
  const [streak, setStreak] = useState(0);
  const [roadmapCompletion, setRoadmapCompletion] = useState(0);
  const [series, setSeries] = useState({ weekly: [], monthly: [], hours: [] });
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedSessions: 0,
    learningHours: 0,
    skillsLearning: 0,
  });

  useEffect(() => {
    loadLearnerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLearnerData = async () => {
    try {
      setLoading(true);
      await client.post("/api/v1/certifications/evaluate").catch(() => null);
      const [bookingsRes, roadmapsRes, watchlistRes, certificationsRes, mentorsRes] =
        await Promise.all([
          client.get("/api/v1/bookings"),
          client.get("/api/v1/roadmaps"),
          client.get("/api/v1/watchlist"),
          client.get("/api/v1/certifications/me").catch(() => ({ data: { data: [] } })),
          client.get("/api/v1/users/mentors").catch(() => ({ data: { data: [] } })),
        ]);

      const allBookings = bookingsRes.data.data || [];
      const allRoadmaps = roadmapsRes.data.data || [];
      const watchlist = watchlistRes.data.data || [];

      const sortedUpcoming = allBookings
        .filter((b) => {
          const start = b?.session?.startTime;
          return start && new Date(start) > new Date();
        })
        .sort(
          (a, b) =>
            new Date(a?.session?.startTime || 0).getTime() -
            new Date(b?.session?.startTime || 0).getTime(),
        );

      const completedBookings = allBookings.filter(
        (b) => (b.bookingStatus || b.status) === "COMPLETED",
      );

      const roadmapPct = allRoadmaps.length
        ? Math.round(
            allRoadmaps.reduce((s, r) => s + Number(r.progressPercent || 0), 0) /
              allRoadmaps.length,
          )
        : 0;

      const uniqueSkills = new Set(
        completedBookings.map((b) => b?.session?.skill?.name).filter(Boolean),
      );
      const activeDays = new Set(
        completedBookings.map((b) => dayKey(b?.session?.startTime)).filter(Boolean),
      );

      // ── progress series ──
      const weekly = [];
      for (let k = 7; k >= 0; k -= 1) weekly.push({ label: k === 0 ? "Now" : `${k}w`, value: 0 });
      const now = new Date();
      completedBookings.forEach((b) => {
        const t = b?.session?.startTime ? new Date(b.session.startTime).getTime() : NaN;
        if (Number.isNaN(t)) return;
        const weeksAgo = Math.floor((now.getTime() - t) / (7 * 86400000));
        if (weeksAgo >= 0 && weeksAgo <= 7) weekly[7 - weeksAgo].value += 1;
      });

      const monthly = buildMonthBuckets();
      const hours = buildMonthBuckets();
      completedBookings.forEach((b) => {
        const key = monthKey(b?.session?.startTime);
        const mBucket = monthly.find((m) => m.key === key);
        if (mBucket) mBucket.value += 1;
        const hBucket = hours.find((m) => m.key === key);
        if (hBucket) hBucket.value += 1.5;
      });
      hours.forEach((m) => {
        m.value = Number(m.value.toFixed(1));
      });

      // ── recommended mentors (best effort) ──
      const mentors = mentorsRes.data.data || [];
      const ranked = [...mentors]
        .sort(
          (a, b) =>
            Number(b.averageRating || b.rating || 0) -
            Number(a.averageRating || a.rating || 0),
        )
        .slice(0, 6);

      setUpcomingSessions(sortedUpcoming);
      setRoadmaps(allRoadmaps);
      setCertifications(certificationsRes.data.data || []);
      setRecommendedMentors(ranked);
      setStreak(computeStreak(activeDays));
      setRoadmapCompletion(roadmapPct);
      setSeries({ weekly, monthly, hours });
      setStats({
        totalBookings: allBookings.length,
        completedSessions: completedBookings.length,
        learningHours: Math.round(allBookings.length * 1.5 * 10) / 10,
        skillsLearning: watchlist.length || uniqueSkills.size,
      });
    } catch (error) {
      console.error("Error loading learner data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="md">
        <SkeletonDashboard />
      </div>
    );
  }

  const nextSession = upcomingSessions[0] || null;

  return (
    <div className="md">
      <LearnerHero
        firstName={firstName}
        nextSession={nextSession}
        roadmapCompletion={roadmapCompletion}
        completedSessions={stats.completedSessions}
        streak={streak}
      />

      {/* ── Statistics (5 cards) ── */}
      <div className="ld-stats md-animate">
        <StatsCard
          icon="task_alt"
          label="Sessions Completed"
          value={stats.completedSessions}
          description="Keep it going"
        />
        <StatsCard
          icon="school"
          label="Skills Learning"
          value={stats.skillsLearning}
          description="On your watchlist"
        />
        <StatsCard
          icon="workspace_premium"
          label="Certificates"
          value={certifications.length}
          description="Earned so far"
        />
        <StatsCard
          icon="local_fire_department"
          label="Learning Streak"
          value={`${streak}d`}
          description="Consecutive days"
        />
        <StatsCard
          icon="schedule"
          label="Hours Learned"
          value={stats.learningHours}
          description="Total time invested"
        />
      </div>

      {/* ── Continue Learning (full width) ── */}
      <div className="md-animate">
        <ContinueLearning roadmaps={roadmaps} />
      </div>

      {/* ── Upcoming Sessions (8) + Learning Progress (4) ── */}
      <div className="ld-row md-animate">
        <div className="ld-c8">
          <LearnerUpcomingSessions sessions={upcomingSessions} />
        </div>
        <div className="ld-c4">
          <LearningProgress series={series} />
        </div>
      </div>

      {/* ── Recommended Mentors (8) + Achievements (4) ── */}
      <div className="ld-row md-animate">
        <div className="ld-c8">
          <MentorRecommendations mentors={recommendedMentors} />
        </div>
        <div className="ld-c4">
          <Achievements
            stats={stats}
            certificates={certifications.length}
            streak={streak}
          />
        </div>
      </div>

      {/* ── Learning Roadmap (8) + Certificates (4) ── */}
      <div className="ld-row md-animate">
        <div className="ld-c8">
          <LearningRoadmap roadmaps={roadmaps} />
        </div>
        <div className="ld-c4">
          <Certificates certificates={certifications} />
        </div>
      </div>
    </div>
  );
}
