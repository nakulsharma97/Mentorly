import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import client from "../api/client";
import ReportModal from "../components/ReportModal";
import StudentHero from "../modules/mentor/components/students/StudentHero";
import StudentSearchBar from "../modules/mentor/components/students/StudentSearchBar";
import StudentCard from "../modules/mentor/components/students/StudentCard";
import StudentDetailsPanel from "../modules/mentor/components/students/StudentDetailsPanel";
import "../modules/mentor/components/students/students.css";

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

function derivePlatform(link) {
  const l = String(link || "").toLowerCase();
  if (l.includes("meet.google")) return "Google Meet";
  if (l.includes("zoom")) return "Zoom";
  if (l.includes("teams")) return "MS Teams";
  if (l.includes("webex")) return "Webex";
  if (l.includes("whereby")) return "Whereby";
  return l ? "Video call" : "";
}

export default function MentorStudentsPage({ profile, notify }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [students, setStudents] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0 });
  const [selectedId, setSelectedId] = useState(null);
  const [reportStudent, setReportStudent] = useState(null);

  const [search, setSearch] = useState("");
  const [skillFilter, setSkillFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [upcomingFilter, setUpcomingFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [panelTab, setPanelTab] = useState("Overview");

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [bookingsRes, reviewsRes] = await Promise.all([
        client.get("/api/v1/bookings"),
        profile?.id
          ? client.get(`/api/v1/reviews/mentor/${profile.id}`).catch(() => ({
              data: { data: { reviews: [], averageRating: 0 } },
            }))
          : Promise.resolve({
              data: { data: { reviews: [], averageRating: 0 } },
            }),
      ]);

      const bookings = bookingsRes?.data?.data || [];
      const reviewSummary = reviewsRes?.data?.data || {};
      const reviews = reviewSummary.reviews || [];

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
        const meetingLink = b?.session?.meetingLink || "";

        const entry = map.get(learner.id) || {
          id: learner.id,
          name: learner.fullName || "Learner",
          email: learner.email || "",
          aboutMe: learner.aboutMe || "",
          skills: learner.skills || "",
          profileImageUrl: learner.profileImageUrl || "",
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
          meetingLink,
          platform: derivePlatform(meetingLink),
        });
        if (status === "COMPLETED") entry.totalSpent += price;
        map.set(learner.id, entry);
      });

      const reviewsByLearner = new Map();
      reviews.forEach((r) => {
        const list = reviewsByLearner.get(r.learnerId) || [];
        list.push(r);
        reviewsByLearner.set(r.learnerId, list);
      });
      const list = Array.from(map.values()).map((s) => {
        const completed = s.bookings.filter(
          (b) => b.status === "COMPLETED",
        ).length;
        const total = s.bookings.length;
        const progress =
          total > 0 ? Math.round((completed / total) * 100) : 0;
        const upcoming = s.bookings
          .filter((b) => b.isUpcoming)
          .sort((a, b) => new Date(a.start) - new Date(b.start))[0];

        const revs = reviewsByLearner.get(s.id) || [];
        const rating = revs.length
          ? revs.reduce((acc, r) => acc + Number(r.rating || 0), 0) / revs.length
          : 0;

        return {
          ...s,
          skill: Array.from(s.skillSet)[0] || "General",
          skills: s.skills || Array.from(s.skillSet).join(", "),
          totalSessions: total,
          completed,
          progress,
          nextBooking: upcoming || null,
          reviews: revs,
          rating,
          reviewCount: revs.length,
          assignments: [],
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
  }, [profile?.id, notify]);

  useEffect(() => {
    document.title = "Students | SkillSwap Mentor";
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

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
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          s.skills.toLowerCase().includes(q),
      );
    if (skillFilter !== "all")
      list = list.filter((s) => s.skillSet.has(skillFilter));
    if (statusFilter !== "all")
      list = list.filter((s) => s.status === statusFilter);
    if (upcomingFilter === "has")
      list = list.filter((s) => Boolean(s.nextBooking));
    if (upcomingFilter === "none")
      list = list.filter((s) => !s.nextBooking);
    const cmp = {
      name: (a, b) => a.name.localeCompare(b.name),
      progress: (a, b) => b.progress - a.progress,
      sessions: (a, b) => b.totalSessions - a.totalSessions,
      newest: (a, b) => new Date(b.joined || 0) - new Date(a.joined || 0),
      oldest: (a, b) => new Date(a.joined || 0) - new Date(b.joined || 0),
    };
    return list.sort(cmp[sortBy] || cmp.newest);
  }, [students, search, skillFilter, statusFilter, upcomingFilter, sortBy]);

  const stats = useMemo(() => {
    const active = students.filter((s) => s.status === "active").length;
    const completedSessions = students.reduce((sum, s) => sum + s.completed, 0);
    return { total: students.length, active, completedSessions };
  }, [students]);

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (skillFilter !== "all" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (upcomingFilter !== "all" ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setSkillFilter("all");
    setStatusFilter("all");
    setUpcomingFilter("all");
  };

  const selected = useMemo(
    () => students.find((s) => s.id === selectedId) || null,
    [students, selectedId],
  );

  const selectStudent = (s) => {
    setSelectedId(s.id);
    if (window.innerWidth < 1100) {
      panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const openSchedule = () => {
    navigate("/mentor/calendar");
  };

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

  const panelStudent = selected || students[0] || null;

  return (
    <div className="ss-crm">
      <div className="ss-crm__inner">
        <StudentHero
          stats={{
            total: stats.total,
            active: stats.active,
            completed: stats.completedSessions,
            avgRating: summary.averageRating,
          }}
          loading={loading}
          refreshing={loading}
          onRefresh={loadStudents}
          onNewSession={() => navigate("/mentor/calendar")}
        />

        <div className="ss-crm__grid">
          <main className="ss-crm__main">
            <StudentSearchBar
              search={search}
              onSearch={setSearch}
              skillOptions={skillOptions}
              skill={skillFilter}
              onSkill={setSkillFilter}
              status={statusFilter}
              onStatus={setStatusFilter}
              upcoming={upcomingFilter}
              onUpcoming={setUpcomingFilter}
              sort={sortBy}
              onSort={setSortBy}
              activeFilterCount={activeFilterCount}
              onReset={resetFilters}
            />

            {loading ? (
              <div className="ss-loading" aria-label="Loading students">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="ss-skel-card" />
                ))}
              </div>
            ) : error ? (
              <div className="ss-empty">
                <div className="ss-empty__art" aria-hidden="true">
                  <span className="material-symbols-outlined">error</span>
                </div>
                <p className="ss-empty__title">Could not load students</p>
                <p className="ss-empty__desc">
                  There was a problem reaching the server. Please try again.
                </p>
                <button
                  type="button"
                  className="ss-empty__btn"
                  onClick={loadStudents}
                >
                  <span className="material-symbols-outlined">refresh</span>
                  Retry
                </button>
              </div>
            ) : students.length === 0 ? (
              <div className="ss-empty">
                <div className="ss-empty__art" aria-hidden="true">
                  <span className="material-symbols-outlined">person_search</span>
                </div>
                <p className="ss-empty__title">
                  You don&apos;t have any learners yet.
                </p>
                <p className="ss-empty__desc">
                  Start mentoring by accepting your first booking.
                </p>
                <button
                  type="button"
                  className="ss-empty__btn"
                  onClick={() => navigate("/mentor/messages")}
                >
                  <span className="material-symbols-outlined">groups</span>
                  Explore Learners
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="ss-empty">
                <div className="ss-empty__art" aria-hidden="true">
                  <span className="material-symbols-outlined">search_off</span>
                </div>
                <p className="ss-empty__title">No matches</p>
                <p className="ss-empty__desc">
                  Try adjusting your search or filters to find what you&apos;re
                  looking for.
                </p>
                <button
                  type="button"
                  className="ss-empty__btn"
                  onClick={resetFilters}
                >
                  <span className="material-symbols-outlined">tune</span>
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="ss-list">
                {filtered.map((s, i) => (
                  <StudentCard
                    key={s.id}
                    student={s}
                    index={i}
                    selected={panelStudent?.id === s.id}
                    onSelect={selectStudent}
                    onMessage={() => navigate("/mentor/messages")}
                    onSchedule={openSchedule}
                  />
                ))}
              </div>
            )}
          </main>

          {!loading && !error && panelStudent && (
            <div ref={panelRef}>
              <StudentDetailsPanel
                student={panelStudent}
                tab={panelTab}
                onTabChange={setPanelTab}
                onMessage={() => navigate("/mentor/messages")}
                onSchedule={openSchedule}
                onDownload={() => downloadReport(panelStudent)}
                onReport={() => setReportStudent(panelStudent)}
              />
            </div>
          )}
        </div>
      </div>

      {reportStudent && (
        <ReportModal
          targetType="LEARNER"
          targetUserId={reportStudent.id}
          targetLabel={reportStudent.name}
          onClose={() => setReportStudent(null)}
          notify={notify}
        />
      )}
    </div>
  );
}
