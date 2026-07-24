import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import { SkeletonTable } from "../components/SkeletonLoaders";
import StatsCard from "../modules/common/dashboard/StatsCard";
import { EmptyState } from "../modules/common/dashboard/SectionCard";
import Icon from "../modules/common/dashboard/Icon";
import StudentDrawer from "../modules/mentor/components/students/StudentDrawer";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import { initials } from "../modules/common/dashboard/dashboardUtils";
import "../modules/mentor/mentor-pages.css";

const ACTIVE_STATUSES = ["PENDING", "ACCEPTED", "CONFIRMED", "IN_PROGRESS"];

function deriveStatus(bookings) {
  const hasUpcoming = bookings.some((b) => b.isUpcoming);
  const hasCompleted = bookings.some((b) => b.status === "COMPLETED");
  const hasOpen = bookings.some((b) => ACTIVE_STATUSES.includes(b.status));
  if (hasUpcoming) return "active";
  if (hasOpen && !hasCompleted) return "pending";
  if (hasCompleted) return "completed";
  return "inactive";
}

export default function MentorStudentsPage({ profile, notify }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0 });
  const [selected, setSelected] = useState(null);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const loadStudentsRef = useRef(null);

  useEffect(() => {
    document.title = "Students | SkillSwap Mentor";
    loadStudentsRef.current?.();
  }, []);

  const loadStudents = async () => {
    setLoading(true);
    setError(false);
    try {
      const [bookingsRes, reviewsRes, roadmapsRes] = await Promise.all([
        client.get("/api/v1/bookings"),
        profile?.id
          ? client.get(`/api/v1/reviews/mentor/${profile.id}`).catch(() => ({
              data: { data: { reviews: [], averageRating: 0 } },
            }))
          : Promise.resolve({
              data: { data: { reviews: [], averageRating: 0 } },
            }),
        client.get("/api/v1/roadmaps").catch(() => ({ data: { data: [] } })),
      ]);

      const bookings = bookingsRes?.data?.data || [];
      const reviewSummary = reviewsRes?.data?.data || {};
      const reviews = reviewSummary.reviews || [];
      const roadmaps = roadmapsRes?.data?.data || [];

      const now = Date.now();
      const map = new Map();

      bookings.forEach((b) => {
        const learner = b?.learner;
        if (!learner?.id) return;
        const status = b?.bookingStatus || b?.status;
        const start = b?.session?.startTime || null;
        const isUpcoming =
          start &&
          new Date(start).getTime() > now &&
          status !== "CANCELLED" &&
          status !== "REJECTED";
        const price = Number(b?.session?.priceAmount || 0);

        const entry = map.get(learner.id) || {
          id: learner.id,
          name: learner.fullName || "Learner",
          email: learner.email || "",
          aboutMe: learner.aboutMe || "",
          skills: learner.skills || "",
          joined: learner.createdAt || b?.createdAt || null,
          lastActive: learner.lastActiveAt || null,
          bookings: [],
          skillSet: new Set(),
          totalSpent: 0,
        };

        const skill = b?.session?.sessionType || b?.session?.title || "General";
        entry.skillSet.add(skill);
        entry.bookings.push({
          id: b.id,
          title: b?.session?.title || skill,
          skill,
          start,
          status,
          isUpcoming,
          price,
          paymentStatus: b?.paymentStatus,
          meetingLink: b?.session?.meetingLink,
        });
        if (status === "COMPLETED") entry.totalSpent += price;
        map.set(learner.id, entry);
      });

      // attach reviews + roadmap progress
      const reviewsByLearner = new Map();
      reviews.forEach((r) => {
        const list = reviewsByLearner.get(r.learnerId) || [];
        list.push(r);
        reviewsByLearner.set(r.learnerId, list);
      });
      const roadmapByLearner = new Map();
      roadmaps.forEach((rm) => {
        const lid = rm?.learner?.id || rm?.booking?.learner?.id;
        if (lid && !roadmapByLearner.has(lid)) roadmapByLearner.set(lid, rm);
      });

      const list = Array.from(map.values()).map((s) => {
        const completed = s.bookings.filter(
          (b) => b.status === "COMPLETED",
        ).length;
        const total = s.bookings.length;
        const rm = roadmapByLearner.get(s.id);
        const roadmapPct = rm ? Number(rm.progressPercent || 0) : null;
        const progress =
          roadmapPct !== null
            ? roadmapPct
            : total > 0
              ? Math.round((completed / total) * 100)
              : 0;
        const upcoming = s.bookings
          .filter((b) => b.isUpcoming)
          .sort((a, b) => new Date(a.start) - new Date(b.start))[0];
        return {
          ...s,
          skill: Array.from(s.skillSet)[0] || "General",
          skills: s.skills || Array.from(s.skillSet).join(", "),
          totalSessions: total,
          completed,
          progress,
          roadmapTitle: rm?.title || rm?.name || "",
          nextSession: upcoming?.start || null,
          reviews: reviewsByLearner.get(s.id) || [],
          status: deriveStatus(s.bookings),
        };
      });

      setStudents(list);
      setSummary({ averageRating: Number(reviewSummary.averageRating || 0) });
    } catch (err) {
      console.error("Failed to load students", err);
      setError(true);
      notify?.({
        type: "error",
        title: "Could not load students",
        message: "Please retry.",
      });
    } finally {
      setLoading(false);
    }
  };

  loadStudentsRef.current = loadStudents;

  const skillOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => s.skillSet.forEach((k) => set.add(k)));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    let list = [...students];
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q),
      );
    if (skillFilter !== "all")
      list = list.filter((s) => s.skillSet.has(skillFilter));
    if (statusFilter !== "all")
      list = list.filter((s) => s.status === statusFilter);
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name),
      progress: (a, b) => b.progress - a.progress,
      sessions: (a, b) => b.totalSessions - a.totalSessions,
      newest: (a, b) => new Date(b.joined || 0) - new Date(a.joined || 0),
      oldest: (a, b) => new Date(a.joined || 0) - new Date(b.joined || 0),
    };
    return list.sort(cmp[sortBy] || cmp.newest);
  }, [students, search, skillFilter, statusFilter, sortBy]);

  const stats = useMemo(() => {
    const active = students.filter((s) => s.status === "active").length;
    const completedSessions = students.reduce((sum, s) => sum + s.completed, 0);
    return { total: students.length, active, completedSessions };
  }, [students]);

  const downloadReport = (student) => {
    const rows = [
      ["Session", "Skill", "Date", "Status", "Price"],
      ...student.bookings.map((b) => [
        b.title,
        b.skill,
        b.start ? new Date(b.start).toLocaleString() : "",
        b.status,
        b.price,
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `learning-report-${student.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify?.({
      type: "success",
      title: "Report downloaded",
      message: `${student.name}'s learning report exported.`,
    });
  };

  return (
    <div className="md md-page">
      <MentorPageHero
        eyebrow="Your Learners"
        icon="groups"
        title="Students"
        sub="Everyone who has booked a session with you, with live progress and history."
      >
        <button
          type="button"
          className="md-btn md-btn--outline md-btn--sm"
          onClick={loadStudents}
        >
          <Icon name="refresh" /> Refresh
        </button>
        <button
          type="button"
          className="md-btn md-btn--brand md-btn--sm"
          onClick={() => navigate("/mentor/calendar")}
        >
          <Icon name="add" /> New Session
        </button>
      </MentorPageHero>

      {/* Summary cards */}
      <div
        className="md-stats md-animate"
        style={{ gridTemplateColumns: "repeat(4, minmax(0,1fr))" }}
      >
        <StatsCard
          icon="groups"
          label="Total Students"
          value={stats.total}
          description="Unique learners"
        />
        <StatsCard
          icon="bolt"
          label="Active Students"
          value={stats.active}
          description="With upcoming sessions"
        />
        <StatsCard
          icon="task_alt"
          label="Completed Sessions"
          value={stats.completedSessions}
          description="Across all learners"
        />
        <StatsCard
          icon="star"
          label="Average Rating"
          value={summary.averageRating || "—"}
          description="From learner reviews"
        />
      </div>

      {/* Toolbar */}
      <div className="md-card md-animate" style={{ gap: 16 }}>
        <div className="mp-toolbar">
          <label className="mp-search">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Search students by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="mp-select"
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            aria-label="Filter by skill"
          >
            <option value="all">All skills</option>
            {skillOptions.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <select
            className="mp-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            className="mp-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort by"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name (A–Z)</option>
            <option value="progress">Progress</option>
            <option value="sessions">Sessions</option>
          </select>
        </div>

        {loading ? (
          <SkeletonTable rows={6} columns={6} />
        ) : error ? (
          <EmptyState
            icon="error"
            title="Couldn't load students"
            description="There was a problem reaching the server."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="groups"
            title={students.length === 0 ? "No students yet" : "No matches"}
            description={
              students.length === 0
                ? "Once learners book your sessions, they'll appear here."
                : "Try adjusting your search or filters."
            }
          />
        ) : (
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th className="mp-col-hide-md">Skill</th>
                  <th className="mp-col-hide-lg">Sessions</th>
                  <th className="mp-col-hide-lg">Upcoming</th>
                  <th className="mp-col-hide-md">Joined</th>
                  <th style={{ minWidth: 140 }}>Progress</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id} onClick={() => setSelected(s)}>
                    <td>
                      <div className="mp-cell-user">
                        <span className="md-avatar md-avatar--sm">
                          {initials(s.name)}
                        </span>
                        <div style={{ minWidth: 0 }}>
                          <p className="mp-cell-user__name">{s.name}</p>
                          <p className="mp-cell-user__email">
                            {s.email || "—"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="mp-col-hide-md">
                      <span className="md-badge md-badge--info">{s.skill}</span>
                    </td>
                    <td className="mp-col-hide-lg">
                      {s.completed}/{s.totalSessions}
                    </td>
                    <td className="mp-col-hide-lg">
                      {s.nextSession
                        ? new Date(s.nextSession).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )
                        : "—"}
                    </td>
                    <td className="mp-col-hide-md">
                      {s.joined
                        ? new Date(s.joined).toLocaleDateString(undefined, {
                            month: "short",
                            year: "2-digit",
                          })
                        : "—"}
                    </td>
                    <td>
                      <div className="mp-cell-progress">
                        <div className="md-progress-track">
                          <div
                            className="md-progress-fill"
                            style={{ width: `${s.progress}%` }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: "0.74rem",
                            fontWeight: 700,
                            color: "var(--md-muted)",
                          }}
                        >
                          {s.progress}%
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`mp-pill mp-pill--${s.status}`}>
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="mp-row-actions">
                        <button
                          className="mp-icon-btn"
                          title="View details"
                          onClick={() => setSelected(s)}
                        >
                          <Icon name="visibility" />
                        </button>
                        <button
                          className="mp-icon-btn"
                          title="Message"
                          onClick={() => navigate("/mentor/messages")}
                        >
                          <Icon name="chat_bubble" />
                        </button>
                        <button
                          className="mp-icon-btn"
                          title="Download report"
                          onClick={() => downloadReport(s)}
                        >
                          <Icon name="download" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <StudentDrawer
          student={selected}
          onClose={() => setSelected(null)}
          onReport={downloadReport}
        />
      )}
    </div>
  );
}
