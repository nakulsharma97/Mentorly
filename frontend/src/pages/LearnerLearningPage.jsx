import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import {
  LearningHero,
  StatsGrid,
  RoadmapTimeline,
  CurrentMilestone,
  MentorCarousel,
  ProjectRecommendations,
  CertificatesSection,
  AchievementsGrid,
  SkillTree,
  AnalyticsChart,
  LearningCalendar,
  AiAssistantCard,
  CareerReadiness,
  CommunitySection,
  ResourcesSection,
  QuickActions,
  EmptyState,
  PageSkeleton,
} from "../modules/learner/components/learningPath";
import {
  clamp,
  buildMilestones,
  milestoneStatus,
  estimateWeeksLeft,
  deriveSkillLevel,
  buildStats,
  buildAchievements,
  buildWeeklySeries,
  buildCalendarEvents,
  deriveCareerReadiness,
  buildProjects,
  deriveAiInsights,
  buildCertificates,
  deriveCommunity,
  buildBookingStats,
  computeStreak,
} from "../modules/learner/components/learningPath/data";
import "../modules/learner/components/learningPath/learning-path.css";

/* Stable empty array reference to avoid creating a new [] on every render */
const EMPTY_ARRAY = [];

/* ──────────────────────────────────────────────────────────────────────────
   Data helpers (same patterns as the rest of the workspace)
   ────────────────────────────────────────────────────────────────────────── */

function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | SkillSwap`;
  }, [title]);
}

function unwrapResponse(payload) {
  if (
    payload &&
    typeof payload === "object" &&
    Object.prototype.hasOwnProperty.call(payload, "data") &&
    Object.prototype.hasOwnProperty.call(payload, "message")
  ) {
    return payload.data;
  }
  return payload;
}

async function apiGet(path, config) {
  const response = await client.get(path, config);
  return unwrapResponse(response.data);
}

async function apiPatch(path, body) {
  const response = await client.patch(path, body);
  return unwrapResponse(response.data);
}

function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    "Unable to load data"
  );
}

function useResource(loader, deps = []) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    Promise.resolve()
      .then(() => loaderRef.current())
      .then((data) => {
        if (!active) return;
        setState({ loading: false, data, error: null });
      })
      .catch((error) => {
        if (!active) return;
        setState({ loading: false, data: null, error: getErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function useLearnerLearningData(refreshKey = 0) {
  return useResource(async () => {
    const [roadmaps, bookings, certifications, savedSkills, profile, mentors] = await Promise.all([
      apiGet("/api/v1/roadmaps").catch(() => []),
      apiGet("/api/v1/bookings").catch(() => []),
      apiGet("/api/v1/certifications/me").catch(() => []),
      apiGet("/api/v1/watchlist/skills").catch(() => []),
      apiGet("/api/v1/users/me").catch(() => null),
      apiGet("/api/v1/users/mentors").catch(() => []),
    ]);
    return {
      roadmaps: roadmaps || EMPTY_ARRAY,
      bookings: bookings || EMPTY_ARRAY,
      certifications: certifications || EMPTY_ARRAY,
      savedSkills: savedSkills || EMPTY_ARRAY,
      profile,
      mentors: mentors || EMPTY_ARRAY,
    };
  }, [refreshKey]);
}

/** Normalize the live-mentor payload into a safe shape for the carousel. */
function normalizeMentors(mentors) {
  return (mentors || EMPTY_ARRAY)
    .map((m) => ({
      id: m.id ?? m.mentorId,
      fullName: m.fullName || m.mentorName || "Mentor",
      skills: m.skills || m.skillNames,
      profileImageUrl: m.profileImageUrl,
      averageRating: Number(m.averageRating || 0),
      totalReviews: Number(m.totalReviews || 0),
      liveNow: Boolean(m.liveNow),
      mentorVerified: Boolean(m.mentorVerified),
      yearsOfExperience: Number(m.yearsOfExperience || 0) || 3,
      availability: m.availability || "Flexible",
      minSessionPrice: m.minSessionPrice ? Number(m.minSessionPrice) : 0,
    }))
    .slice(0, 8);
}

/* ──────────────────────────────────────────────────────────────────────────
   Page
   ────────────────────────────────────────────────────────────────────────── */

export default function LearnerLearningPage() {
  const location = useLocation();
  const isPathPage = location.pathname.startsWith("/learner/path");
  useDocumentTitle(isPathPage ? "Learning Path" : "My Learning");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);
  const saveMsgTimerRef = useRef(null);

  useEffect(
    () => () => {
      if (saveMsgTimerRef.current) clearTimeout(saveMsgTimerRef.current);
    },
    [],
  );

  const roadmaps = data?.roadmaps || EMPTY_ARRAY;
  const bookings = data?.bookings || EMPTY_ARRAY;
  const certifications = data?.certifications || EMPTY_ARRAY;
  const savedSkills = data?.savedSkills || EMPTY_ARRAY;
  const profile = data?.profile || null;
  const mentors = useMemo(() => normalizeMentors(data?.mentors), [data?.mentors]);

  /* ── Derived state ── */
  const { upcoming, completed, totalHours } = useMemo(() => buildBookingStats(bookings), [bookings]);
  const streak = useMemo(() => computeStreak(bookings), [bookings]);

  const currentRoadmaps = useMemo(
    () => roadmaps.filter((r) => Number(r.progressPercent || 0) < 100),
    [roadmaps],
  );
  const completedRoadmaps = useMemo(
    () => roadmaps.filter((r) => Number(r.progressPercent || 0) >= 100),
    [roadmaps],
  );
  const overallProgress = useMemo(
    () =>
      roadmaps.length
        ? Math.round(roadmaps.reduce((s, r) => s + Number(r.progressPercent || 0), 0) / roadmaps.length)
        : 0,
    [roadmaps],
  );
  const activeRoadmap = useMemo(
    () => currentRoadmaps[0] || roadmaps[0] || null,
    [currentRoadmaps, roadmaps],
  );

  const milestones = useMemo(() => buildMilestones(activeRoadmap), [activeRoadmap]);
  const statusedMilestones = useMemo(
    () =>
      milestones.map((m) => ({
        ...m,
        status: milestoneStatus(m.index, milestones.length, activeRoadmap?.progressPercent),
      })),
    [milestones, activeRoadmap],
  );
  const currentMilestone = useMemo(
    () => statusedMilestones.find((m) => m.status === "current") || null,
    [statusedMilestones],
  );
  const weeksLeft = useMemo(
    () => estimateWeeksLeft(milestones, activeRoadmap?.progressPercent),
    [milestones, activeRoadmap],
  );

  const stats = useMemo(
    () =>
      buildStats({
        roadmaps,
        bookings,
        certifications,
        projectsCompleted: Math.max(0, Math.round(overallProgress / 25)),
      }),
    [roadmaps, bookings, certifications, overallProgress],
  );

  const achievements = useMemo(
    () =>
      buildAchievements({
        streak,
        completedRoadmaps: completedRoadmaps.length,
        certifications,
        totalHours,
        completedSessions: completed.length,
        overallProgress,
      }),
    [streak, completedRoadmaps, certifications, totalHours, completed, overallProgress],
  );

  const weeklySeries = useMemo(() => buildWeeklySeries(bookings), [bookings]);
  const calendarEvents = useMemo(() => buildCalendarEvents(bookings), [bookings]);
  const readiness = useMemo(
    () =>
      deriveCareerReadiness({
        profile,
        bookings,
        roadmaps,
        certifications,
        mentors,
      }),
    [profile, bookings, roadmaps, certifications, mentors],
  );
  const projects = useMemo(() => buildProjects(overallProgress), [overallProgress]);
  const certificateCards = useMemo(
    () => buildCertificates(certifications, statusedMilestones, overallProgress),
    [certifications, statusedMilestones, overallProgress],
  );
  const community = useMemo(
    () => deriveCommunity({ mentors, bookings }),
    [mentors, bookings],
  );
  const aiInsights = useMemo(
    () =>
      deriveAiInsights({
        milestones: statusedMilestones,
        bookings,
        certifications,
      }),
    [statusedMilestones, bookings, certifications],
  );

  const goals = {
    weeklyHours: 4,
    monthlySessions: 12,
    projectsDone: Math.max(0, Math.round(overallProgress / 25)),
    projectsTotal: 5,
  };

  const careerGoal = profile?.headline || activeRoadmap?.title || "Become Java Backend Developer";

  // Assigned mentor + next session for the focus card
  const assignedMentor = activeRoadmap?.booking?.session?.mentor || null;
  const nextSession = upcoming[0]?.session || null;

  /* ── Milestone toggle (persists to the backend, same contract as before) ── */
  const handleMilestoneToggle = async (index) => {
    if (!activeRoadmap || saving) return;
    const total = milestones.length;
    if (!total) return;
    const wasDone =
      milestoneStatus(index, total, activeRoadmap.progressPercent) === "completed";
    const newPct = wasDone
      ? Math.max(0, Math.round((index / total) * 100))
      : Math.round(((index + 1) / total) * 100);
    const clamped = clamp(newPct, 0, 100);
    setSaving(true);
    try {
      await apiPatch(`/api/v1/roadmaps/${activeRoadmap.id}`, {
        progressPercent: clamped,
        milestones: activeRoadmap.milestones,
      });
      setSaveMsg({ type: "success", text: "Milestone updated!" });
      if (saveMsgTimerRef.current) clearTimeout(saveMsgTimerRef.current);
      saveMsgTimerRef.current = setTimeout(() => {
        setRefreshKey((k) => k + 1);
        setSaveMsg(null);
      }, 900);
    } catch (err) {
      setSaveMsg({ type: "error", text: getErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  /* ── Loading ── */
  if (loading) return <PageSkeleton />;

  /* ── Error ── */
  if (error) {
    return (
      <div className="lp-shell">
        <EmptyState
          icon="error"
          title="Learning data could not be loaded"
          description={error}
          actions={
            <button
              type="button"
              className="lp-btn lp-btn--primary"
              onClick={() => setRefreshKey((v) => v + 1)}
            >
              <Icon name="refresh" /> Retry
            </button>
          }
        />
      </div>
    );
  }

  /* ── Empty (brand new learner) ── */
  const isEmpty = roadmaps.length === 0 && bookings.length === 0 && savedSkills.length === 0;

  if (isEmpty) {
    return (
      <div className="lp-shell">
        <LearningHero
          profile={profile}
          careerGoal={careerGoal}
          overallProgress={0}
          streak={0}
          totalHours={0}
          certifications={[]}
          skillLevel="Getting Started"
          weeksLeft={14}
          currentMilestone={null}
          hasRoadmap={false}
        />
        <EmptyState
          emoji="🎓"
          title="Start Your Learning Journey"
          description="Book your first mentor session and begin tracking your progress. Explore skills, find mentors, and build your learning roadmap from beginner to job-ready."
          actions={
            <>
              <Link to="/learner/skills" className="lp-btn lp-btn--primary">
                <Icon name="auto_stories" /> Explore Skills
              </Link>
              <Link to="/learner/mentors" className="lp-btn lp-btn--outline">
                <Icon name="person_search" /> Find a Mentor
              </Link>
            </>
          }
        />
        <QuickActions />
        <ResourcesSection />
      </div>
    );
  }

  return (
    <div className="lp-shell">
      {/* 1 — Hero banner */}
      <LearningHero
        profile={profile}
        careerGoal={careerGoal}
        overallProgress={overallProgress}
        streak={streak}
        totalHours={totalHours}
        certifications={certifications}
        skillLevel={deriveSkillLevel(overallProgress)}
        weeksLeft={weeksLeft}
        currentMilestone={currentMilestone}
        hasRoadmap={Boolean(activeRoadmap)}
      />

      {/* 2 — Overview statistics */}
      <StatsGrid stats={stats} />

      {/* 3 — Career roadmap timeline */}
      <RoadmapTimeline
        milestones={milestones}
        progressPercent={activeRoadmap?.progressPercent || 0}
        onToggleMilestone={handleMilestoneToggle}
      />
      {saveMsg && (
        <p
          className={`lp-save-msg ${saveMsg.type === "success" ? "is-ok" : "is-error"}`}
          role="status"
        >
          <Icon name={saveMsg.type === "success" ? "check_circle" : "error"} /> {saveMsg.text}
        </p>
      )}

      {/* 4 — Current milestone focus */}
      {currentMilestone && (
        <CurrentMilestone
          milestone={currentMilestone}
          progress={Math.round(Number(activeRoadmap?.progressPercent || 0))}
          mentor={assignedMentor}
          nextSession={nextSession}
          weeksLeft={weeksLeft}
        />
      )}

      {/* 5 — Recommended mentors */}
      <MentorCarousel mentors={mentors} />

      {/* 6 — Projects */}
      <ProjectRecommendations projects={projects} />

      {/* 7 — Certificates */}
      <CertificatesSection certificates={certificateCards} />

      {/* 8 — Achievements */}
      <AchievementsGrid achievements={achievements} />

      {/* 9 — Skill tree */}
      <SkillTree milestones={statusedMilestones} />

      {/* 10 — Weekly analytics */}
      <AnalyticsChart weeklySeries={weeklySeries} stats={{ hours: totalHours, sessions: completed.length }} goals={goals} />

      {/* 11 — Learning calendar */}
      <LearningCalendar events={calendarEvents} milestones={statusedMilestones} />

      {/* 12 — AI assistant */}
      <AiAssistantCard insights={aiInsights} />

      {/* 13 — Career readiness */}
      <CareerReadiness readiness={readiness} />

      {/* 14 — Community */}
      <CommunitySection community={community} />

      {/* 15 — Resources */}
      <ResourcesSection />

      {/* 16 — Quick actions */}
      <QuickActions />
    </div>
  );
}
