import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import client from "../api/client";
import OptimizedImage from "../components/OptimizedImage";

const courseCards = [
  {
    level: "ADVANCED",
    domain: "DESIGN",
    modules: "8 MODULES",
    title: "Editorial UI Layouts",
    desc: "Master the art of negative space and typography in modern interface design.",
    rating: "4.9",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuAoMJpmkwuAuc8iV7ZWan0JL5KzTC8PSSp8Yp7MwP4eayjypXyl58ahFM4_TU0LCABCHNU_KL7u0imcOObtR2KvviqFGIjRXcmcOkNgiTwYHGNnmOUnV1B8vVlipjAwAkpgVUOwy4BeaFgTKil9buVQHzmoWgSi_vOm85GegPrsWVJQEK49NG9Yi7RiZxfbMIOwmq7wk8XRzSUwXJLIM0xioSpc3cfjt6uma86nnWLjEgGBjTN7mEmrCxw70xn_vdw0TTZr9vx2BZSe",
  },
  {
    level: "INTERMEDIATE",
    domain: "FINANCE",
    modules: "12 MODULES",
    title: "Market Dynamics 101",
    desc: "Learn to read market signals and develop robust investment frameworks.",
    rating: "4.8",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDB3roCJk61DB0DiT5vgUpKWuGl9Wn9xge24eaFiD1Qi-p9T-2BesW3N4J2ssnz7lWD2rOFN9RdidIYlsX0MZwnbFu98Z0aLFYgPrItguB2eZLyHjI1-CPe7wT91o0kbyJ3ht7UY1vo-kvu6uQWGmwvXPvH4L76Z-B3Gd-4YCnP5QHcBjl8WgemBi9LWMnY5beMLtPqrwQQTx0sMJl3EVvO21jFkS94besrIWy3HlMpVdZoJBxvE_lgbxHaAHh-0BkanE_Y8DH6qHXX",
  },
];

const trendingSkills = [
  "Creative Direction",
  "Python for Data",
  "Brand Storytelling",
  "Public Speaking",
  "Leadership",
  "Motion Graphics",
];

const formatCurrency = (amount) => {
  const safe = Number(amount || 0);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
};

const formatTimeRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return "TBD";
  }
  const fmt = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${fmt.format(s)} - ${fmt.format(e)}`;
};

const getSessionBadge = (startTime) => {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  if (!Number.isFinite(start)) {
    return "UPCOMING";
  }
  const diffMin = Math.max(0, Math.floor((start - now) / (1000 * 60)));
  if (diffMin < 60) {
    return `IN ${diffMin} MIN`;
  }
  if (diffMin < 24 * 60) {
    return "TODAY";
  }
  return "UPCOMING";
};

export default function ExecutiveDashboard({ profile, onLogout }) {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [utilityMessage, setUtilityMessage] = useState("");

  const fullName = String(profile?.fullName || "Alex").trim();
  const firstName = fullName.split(" ")[0] || "Alex";
  const avatar = String(profile?.profileImageUrl || "").trim();
  const userInitial = fullName.charAt(0).toUpperCase();
  const myId = profile?.id;
  const isMentor = String(profile?.role || "") === "MENTOR";
  const liveDateLabel = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        month: "short",
        day: "2-digit",
      })
        .format(new Date())
        .toUpperCase(),
    [],
  );

  useEffect(() => {
    if (!myId) {
      setLoadingStats(false);
      return;
    }

    let isMounted = true;
    const loadStats = async () => {
      setLoadingStats(true);
      const results = await Promise.allSettled([
        client.get("/api/v1/bookings"),
        client.get("/api/v1/payments"),
        client.get("/api/v1/roadmaps"),
      ]);

      if (!isMounted) {
        return;
      }

      const getData = (index) => {
        const result = results[index];
        if (result?.status === "fulfilled") {
          return result.value?.data?.data || [];
        }
        return [];
      };

      setBookings(getData(0));
      setPayments(getData(1));
      setRoadmaps(getData(2));
      setLoadingStats(false);
    };

    loadStats();
    return () => {
      isMounted = false;
    };
  }, [myId]);

  const stats = useMemo(() => {
    const mentorBookings = bookings.filter(
      (b) => b?.session?.mentor?.id === myId,
    );
    const learnerBookings = bookings.filter((b) => b?.learner?.id === myId);
    const relevantBookings = isMentor ? mentorBookings : learnerBookings;

    const releasedPayments = payments.filter(
      (p) =>
        String(p?.status || "") === "RELEASED" &&
        (isMentor
          ? p?.booking?.session?.mentor?.id === myId
          : p?.booking?.learner?.id === myId),
    );
    const totalEarnings = releasedPayments.reduce(
      (sum, p) => sum + Number(p?.amount || 0),
      0,
    );

    const uniqueCounterParty = new Set(
      relevantBookings
        .map((b) => (isMentor ? b?.learner?.id : b?.session?.mentor?.id))
        .filter(Boolean),
    );

    const roadmapProgress = roadmaps
      .filter(
        (r) =>
          r?.booking?.learner?.id === myId ||
          r?.booking?.session?.mentor?.id === myId,
      )
      .map((r) => Number(r?.progressPercent || 0));

    let learningProgress = 0;
    if (roadmapProgress.length > 0) {
      learningProgress = Math.round(
        roadmapProgress.reduce((a, b) => a + b, 0) / roadmapProgress.length,
      );
    } else if (relevantBookings.length > 0) {
      const completed = relevantBookings.filter(
        (b) => String(b?.bookingStatus || "") === "COMPLETED",
      ).length;
      learningProgress = Math.round(
        (completed / relevantBookings.length) * 100,
      );
    }

    const responseRate =
      relevantBookings.length > 0
        ? Math.round(
            (relevantBookings.filter((b) =>
              ["ACCEPTED", "COMPLETED"].includes(
                String(b?.bookingStatus || ""),
              ),
            ).length /
              relevantBookings.length) *
              100,
          )
        : 0;

    return {
      totalEarnings,
      activeLearners: uniqueCounterParty.size,
      learningProgress,
      responseRate,
    };
  }, [bookings, isMentor, myId, payments, roadmaps]);

  const upcomingSessionCards = useMemo(() => {
    const now = Date.now();
    return bookings
      .filter((b) => {
        const start = new Date(b?.session?.startTime || 0).getTime();
        const mine = b?.learner?.id === myId || b?.session?.mentor?.id === myId;
        const validStatus = [
          "PENDING",
          "ACCEPTED",
          "RESCHEDULE_REQUESTED",
        ].includes(String(b?.bookingStatus || ""));
        return mine && validStatus && Number.isFinite(start) && start > now;
      })
      .sort(
        (a, b) =>
          new Date(a?.session?.startTime).getTime() -
          new Date(b?.session?.startTime).getTime(),
      )
      .slice(0, 3)
      .map((b) => {
        const other =
          b?.session?.mentor?.id === myId ? b?.learner : b?.session?.mentor;
        return {
          mentor: String(other?.fullName || "SkillSwap Mentor"),
          title: String(b?.session?.title || "Upcoming Session"),
          time: formatTimeRange(b?.session?.startTime, b?.session?.endTime),
          status: getSessionBadge(b?.session?.startTime),
          icon: "video_call",
          image: String(other?.profileImageUrl || "").trim(),
        };
      });
  }, [bookings, myId]);

  return (
    <div className="bg-surface text-on-surface min-h-screen">
      <aside className="fixed left-0 top-20 h-[calc(100vh-5rem)] w-64 border-r border-emerald-500/5 bg-slate-50 flex-col py-8 px-4 text-sm hidden lg:flex">
        <div className="flex items-center gap-3 px-4 mb-10">
          {avatar ? (
            <img
              alt="User profile thumbnail"
              className="w-10 h-10 rounded-full object-cover"
              src={avatar}
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center font-bold text-primary">
              {userInitial}
            </div>
          )}
          <div>
            <p className="font-bold text-emerald-900">{fullName}</p>
            <p className="text-xs text-slate-500">Expert Curator</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <Link
            className="flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-900 font-bold border-r-4 border-emerald-700"
            to="/admin/dashboard"
          >
            <span className="material-symbols-outlined">grid_view</span> Home
          </Link>
          <Link
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 hover:text-emerald-700"
            to="/sessions"
          >
            <span className="material-symbols-outlined">school</span> My
            Learning
          </Link>
          <Link
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 hover:text-emerald-700"
            to="/mentors"
          >
            <span className="material-symbols-outlined">edit_note</span>{" "}
            Teaching
          </Link>
          <Link
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 hover:text-emerald-700"
            to="/wallet"
          >
            <span className="material-symbols-outlined">trending_up</span>{" "}
            Analytics
          </Link>
          <Link
            className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-100 hover:text-emerald-700"
            to="/resources"
          >
            <span className="material-symbols-outlined">inventory_2</span>{" "}
            Resources
          </Link>
        </nav>

        <div className="mt-auto space-y-1">
          <div className="bg-primary text-on-primary p-4 rounded-xl mb-6 shadow-lg shadow-emerald-900/10">
            <p className="font-bold mb-1">Upgrade to Pro</p>
            <p className="text-xs text-white/80 mb-3">
              Access exclusive workshops and advanced analytics.
            </p>
            <button
              type="button"
              className="w-full bg-white text-primary py-2 rounded-lg font-bold text-xs"
              onClick={() => navigate("/role-guide")}
            >
              Learn More
            </button>
          </div>
          <Link
            className="flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-100"
            to="/resources"
          >
            <span className="material-symbols-outlined">help</span> Help Center
          </Link>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-left flex items-center gap-3 px-4 py-2 text-slate-600 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined">logout</span> Sign Out
          </button>
        </div>
      </aside>

      <div className="pt-6 lg:ml-64 px-5 pb-5 md:px-12 md:pb-12 min-h-screen">
        {utilityMessage && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {utilityMessage}
          </div>
        )}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-6">
            <div>
              <span className="inline-block bg-tertiary-fixed text-on-tertiary-fixed-variant px-3 py-1 rounded-full text-xs font-bold font-label mb-3">
                {liveDateLabel}
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold text-on-surface tracking-tight leading-tight">
                Welcome back,
                <br />
                {firstName}.
              </h1>
            </div>
            <div className="text-right">
              <p className="text-on-surface-variant font-label text-sm mb-1">
                Session Availability
              </p>
              <p className="text-emerald-700 font-bold text-lg">
                {loadingStats ? "..." : `${stats.responseRate}% Response Rate`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_12px_32px_rgba(17,28,45,0.06)] border border-emerald-500/5">
              <span className="material-symbols-outlined text-primary mb-4 p-3 bg-primary-fixed/30 rounded-xl">
                payments
              </span>
              <h3 className="text-on-surface-variant font-semibold text-sm">
                Total Earnings
              </h3>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-on-surface">
                  {loadingStats ? "..." : formatCurrency(stats.totalEarnings)}
                </span>
                <p className="text-emerald-600 text-xs mt-2 font-semibold">
                  Live backend aggregate
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-[0_12px_32px_rgba(17,28,45,0.06)] border border-emerald-500/5">
              <span className="material-symbols-outlined text-primary mb-4 p-3 bg-primary-fixed/30 rounded-xl">
                group
              </span>
              <h3 className="text-on-surface-variant font-semibold text-sm">
                Active Learners
              </h3>
              <div className="mt-6">
                <span className="text-4xl font-extrabold text-on-surface">
                  {loadingStats ? "..." : stats.activeLearners}
                </span>
                <div className="flex -space-x-2 mt-3">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-high" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-highest" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-surface-container-high" />
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    Live
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-surface-container-low p-8 rounded-2xl overflow-hidden relative">
              <div className="relative z-10">
                <span className="material-symbols-outlined text-primary mb-4 p-3 bg-primary-fixed/50 rounded-xl">
                  auto_graph
                </span>
                <h3 className="text-on-surface-variant font-semibold text-sm">
                  Learning Progress
                </h3>
                <div className="mt-6">
                  <span className="text-4xl font-extrabold text-on-surface">
                    {loadingStats ? "..." : `${stats.learningProgress}%`}
                  </span>
                  <div className="w-full bg-slate-200 h-2 rounded-full mt-4 overflow-hidden">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.max(0, stats.learningProgress))}%`,
                      }}
                    />
                  </div>
                  <p className="text-on-surface-variant text-xs mt-3">
                    Computed from your roadmap and booking progress
                  </p>
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 opacity-10">
                <span
                  className="material-symbols-outlined text-[120px]"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  architecture
                </span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 items-start">
          <div className="xl:col-span-4 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-on-surface">
                Upcoming Sessions
              </h2>
              <Link
                className="text-primary font-bold text-sm hover:underline"
                to="/sessions"
              >
                View Calendar
              </Link>
            </div>

            <div className="space-y-4">
              {upcomingSessionCards.length > 0 ? (
                upcomingSessionCards.map((item) => (
                  <div
                    key={`${item.mentor}-${item.time}`}
                    className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow border border-emerald-500/5 group"
                  >
                    <div className="flex gap-4 items-center mb-4">
                      {item.image ? (
                        <OptimizedImage
                          alt={item.mentor}
                          className="w-12 h-12 rounded-xl object-cover"
                          src={item.image}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-primary font-bold">
                          {String(item.mentor).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-on-surface text-sm">
                          {item.mentor}
                        </p>
                        <p className="text-on-surface-variant text-xs">
                          {item.title}
                        </p>
                      </div>
                      <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">
                        {item.icon}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                      <div className="flex items-center gap-2 text-on-tertiary-fixed-variant">
                        <span className="material-symbols-outlined text-sm">
                          schedule
                        </span>
                        <span className="text-xs font-bold">{item.time}</span>
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-400">
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-emerald-500/5 opacity-60">
                  <div className="flex gap-4 items-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center">
                      <span className="material-symbols-outlined text-slate-400">
                        person
                      </span>
                    </div>
                    <div>
                      <p className="font-bold text-on-surface text-sm">
                        Waitlist Open
                      </p>
                      <p className="text-on-surface-variant text-xs">
                        No upcoming sessions yet
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-on-surface">
                My Skills &amp; Courses
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm"
                  onClick={() => navigate("/resources")}
                  aria-label="Browse resources"
                >
                  <span className="material-symbols-outlined text-slate-600">
                    search
                  </span>
                </button>
                <button
                  type="button"
                  className="bg-white p-2 rounded-lg border border-slate-100 shadow-sm"
                  onClick={() =>
                    setUtilityMessage(
                      "Showing your active bookings, upcoming sessions, and current roadmap progress. Use the search button to browse more resources.",
                    )
                  }
                  aria-label="Open filters"
                >
                  <span className="material-symbols-outlined text-slate-600">
                    tune
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {courseCards.map((course) => (
                <div
                  key={course.title}
                  className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(17,28,45,0.04)] border border-emerald-500/5 hover:translate-y-[-4px] transition-all duration-300"
                >
                  <div className="h-40 bg-slate-200 overflow-hidden relative">
                    <OptimizedImage
                      alt={course.title}
                      className="w-full h-full object-cover"
                      src={course.image}
                    />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full">
                      <span className="text-[10px] font-bold text-primary">
                        {course.level}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="flex gap-2 mb-3">
                      <span className="text-[10px] font-bold bg-tertiary-fixed text-on-tertiary-fixed px-2 py-0.5 rounded-md">
                        {course.domain}
                      </span>
                      <span className="text-[10px] font-bold bg-secondary-fixed text-on-secondary-fixed px-2 py-0.5 rounded-md">
                        {course.modules}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-on-surface mb-2">
                      {course.title}
                    </h3>
                    <p className="text-on-surface-variant text-sm line-clamp-2 mb-4">
                      {course.desc}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="material-symbols-outlined text-emerald-600 text-sm"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          star
                        </span>
                        <span className="text-xs font-bold text-on-surface">
                          {course.rating}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-primary font-bold text-sm flex items-center gap-1 group"
                        onClick={() => navigate("/sessions")}
                      >
                        Continue{" "}
                        <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="md:col-span-2 mt-4">
                <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-4">
                  Trending Skills for You
                </p>
                <div className="flex flex-wrap gap-3">
                  {trendingSkills.map((skill, index) => (
                    <span
                      key={skill}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${index === 1 ? "bg-tertiary-fixed text-on-tertiary-fixed hover:bg-on-tertiary-fixed-variant hover:text-white" : index === 4 ? "bg-secondary-fixed text-on-secondary-fixed-variant hover:bg-primary hover:text-white" : "bg-surface-container-high text-primary hover:bg-primary hover:text-white"}`}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
