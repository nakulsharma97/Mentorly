import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import client from "../api/client";
import { getErrorFeedback } from "../utils/comingSoon";

/* Stable empty array reference to avoid creating a new [] on every render */
const EMPTY_ARRAY = [];

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(toNumber(value));

const formatCompactCurrency = (value) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toNumber(value));

const formatDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(date);
};

const getTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const getSessionHours = (booking) => {
  const start = getTime(booking?.session?.startTime);
  const end = getTime(booking?.session?.endTime);
  if (!start || !end || end <= start) {
    return 0;
  }
  return (end - start) / (1000 * 60 * 60);
};

const monthKey = (date) => `${date.getFullYear()}-${date.getMonth()}`;

const CSV_HEADER = ["Mentor", "Sessions Attended", "Hours Learned", "Spend"];

const toCsvLine = (values) =>
  values.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",");

export const buildLearnerHistoryCsv = ({
  rangeDays,
  learnerHistory,
  mentors,
}) => {
  const rows = [
    ["Range Days", String(rangeDays)],
    [
      "Total Sessions Attended",
      String(learnerHistory?.totalSessionsAttended ?? 0),
    ],
    [
      "Average Session Length (hours)",
      String(learnerHistory?.averageSessionLengthHours ?? 0),
    ],
    [],
    CSV_HEADER,
  ];

  mentors.forEach((mentor) => {
    rows.push([
      mentor.name,
      String(mentor.sessionsAttended),
      mentor.totalHours.toFixed(1),
      toNumber(mentor.totalSpend).toFixed(2),
    ]);
  });

  return rows.map(toCsvLine).join("\n");
};

const HISTORY_STATE_STORAGE_KEY = "learnerHistoryState";

export default function AnalyticsPage({ profile }) {
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [rangeDays, setRangeDays] = useState(30);
  const [mentorSearch, setMentorSearch] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(HISTORY_STATE_STORAGE_KEY) || "{}",
      );
      return String(stored.mentorSearch || "");
    } catch {
      return "";
    }
  });
  const [historySortBy, setHistorySortBy] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(HISTORY_STATE_STORAGE_KEY) || "{}",
      );
      return ["spend", "sessions", "hours"].includes(stored.historySortBy)
        ? stored.historySortBy
        : "spend";
    } catch {
      return "spend";
    }
  });
  const [historySortDirection, setHistorySortDirection] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(HISTORY_STATE_STORAGE_KEY) || "{}",
      );
      return stored.historySortDirection === "asc" ? "asc" : "desc";
    } catch {
      return "desc";
    }
  });
  const [bookings, setBookings] = useState([]);
  const [payments, setPayments] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const isMentor = profile?.role === "MENTOR";

  useEffect(() => {
    if (isMentor) {
      return;
    }
    localStorage.setItem(
      HISTORY_STATE_STORAGE_KEY,
      JSON.stringify({
        mentorSearch,
        historySortBy,
        historySortDirection,
      }),
    );
  }, [historySortBy, historySortDirection, isMentor, mentorSearch]);

  useEffect(() => {
    let isMounted = true;

    const loadAnalytics = async () => {
      setLoading(true);
      setErrorText("");

      const [bookingsResult, paymentsResult, roadmapsResult, reviewsResult] =
        await Promise.allSettled([
          client.get("/api/v1/bookings"),
          client.get("/api/v1/payments"),
          client.get("/api/v1/roadmaps"),
          isMentor
            ? client.get("/api/v1/reviews/mentor")
            : Promise.resolve({ data: { data: [] } }),
        ]);

      if (!isMounted) {
        return;
      }

      const readData = (result) =>
        result?.status === "fulfilled" ? result?.value?.data?.data || EMPTY_ARRAY : EMPTY_ARRAY;

      setBookings(readData(bookingsResult));
      setPayments(readData(paymentsResult));
      setRoadmaps(readData(roadmapsResult));
      setReviews(readData(reviewsResult));

      if (
        bookingsResult.status === "rejected" &&
        paymentsResult.status === "rejected" &&
        roadmapsResult.status === "rejected"
      ) {
        setErrorText(getErrorFeedback("analyticsLoadFailed").message);
      }

      setLoading(false);
    };

    loadAnalytics();

    return () => {
      isMounted = false;
    };
  }, [isMentor]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff = now - rangeDays * 24 * 60 * 60 * 1000;

    const filteredBookings = bookings.filter((booking) => {
      const bookingTime = getTime(
        booking?.session?.startTime || booking?.updatedAt || booking?.createdAt,
      );
      return bookingTime >= cutoff;
    });

    const filteredPayments = payments.filter((payment) => {
      const paymentTime = getTime(payment?.updatedAt || payment?.createdAt);
      return paymentTime >= cutoff;
    });

    return {
      bookings: filteredBookings,
      payments: filteredPayments,
    };
  }, [bookings, payments, rangeDays]);

  const analytics = useMemo(() => {
    const relevantBookings = filtered.bookings;
    const relevantPayments = filtered.payments;

    const releasedPayments = relevantPayments.filter(
      (payment) => String(payment?.status || "") === "RELEASED",
    );
    const settledPayments = relevantPayments.filter((payment) =>
      ["RELEASED", "COMPLETED", "SUCCEEDED"].includes(
        String(payment?.status || "").toUpperCase(),
      ),
    );
    const pendingPayments = relevantPayments.filter((payment) =>
      ["HELD", "AUTHORIZED", "PENDING"].includes(String(payment?.status || "")),
    );
    const totalEarnings = releasedPayments.reduce(
      (sum, payment) => sum + toNumber(payment?.amount),
      0,
    );
    const totalSpent = settledPayments.reduce(
      (sum, payment) => sum + toNumber(payment?.amount),
      0,
    );
    const pendingAmount = pendingPayments.reduce(
      (sum, payment) => sum + toNumber(payment?.amount),
      0,
    );

    const uniqueLearners = new Set(
      relevantBookings.map((booking) => booking?.learner?.id).filter(Boolean),
    );

    const uniqueMentors = new Set(
      relevantBookings
        .map(
          (booking) =>
            booking?.session?.mentor?.id || booking?.session?.mentor?.fullName,
        )
        .filter(Boolean),
    );

    const completedBookings = relevantBookings.filter(
      (booking) => String(booking?.bookingStatus || "") === "COMPLETED",
    );
    const totalHoursLearned = completedBookings.reduce(
      (sum, booking) => sum + getSessionHours(booking),
      0,
    );

    const completedCount = completedBookings.length;
    const completionRate =
      relevantBookings.length > 0
        ? Math.round((completedCount / relevantBookings.length) * 100)
        : 0;

    const progressValues = roadmaps
      .map((roadmap) => toNumber(roadmap?.progressPercent))
      .filter((value) => value > 0);
    const averageProgress =
      progressValues.length > 0
        ? Math.round(
            progressValues.reduce((a, b) => a + b, 0) / progressValues.length,
          )
        : 0;

    const amountPayments = isMentor ? releasedPayments : settledPayments;

    const paymentByBookingId = amountPayments.reduce((acc, payment) => {
      const bookingId = String(payment?.booking?.id || "");
      if (!bookingId) {
        return acc;
      }
      acc[bookingId] = (acc[bookingId] || 0) + toNumber(payment?.amount);
      return acc;
    }, {});

    const topSessions = [...relevantBookings]
      .sort(
        (a, b) =>
          getTime(b?.session?.startTime || b?.createdAt) -
          getTime(a?.session?.startTime || a?.createdAt),
      )
      .slice(0, 6)
      .map((booking) => {
        const bookingId = String(booking?.id || "");
        return {
          id: bookingId,
          title: String(booking?.session?.title || "Untitled Session"),
          date: booking?.session?.startTime || booking?.createdAt,
          status: String(booking?.bookingStatus || "PENDING"),
          amount: paymentByBookingId[bookingId] || 0,
          hours: getSessionHours(booking),
        };
      });

    const mentorHistoryMap = {};
    const mentorByBookingId = {};

    relevantBookings.forEach((booking) => {
      const mentorName = String(
        booking?.session?.mentor?.fullName || "Mentor",
      ).trim();
      const mentorKey = String(
        booking?.session?.mentor?.id || mentorName || "",
      ).trim();
      const bookingId = String(booking?.id || "").trim();

      if (!mentorKey) {
        return;
      }

      if (!mentorHistoryMap[mentorKey]) {
        mentorHistoryMap[mentorKey] = {
          id: mentorKey,
          name: mentorName,
          sessionsAttended: 0,
          totalHours: 0,
          totalSpend: 0,
        };
      }

      if (bookingId) {
        mentorByBookingId[bookingId] = mentorKey;
      }

      const isCompleted =
        String(booking?.bookingStatus || "").toUpperCase() === "COMPLETED";
      if (isCompleted) {
        mentorHistoryMap[mentorKey].sessionsAttended += 1;
        mentorHistoryMap[mentorKey].totalHours += getSessionHours(booking);
      }
    });

    settledPayments.forEach((payment) => {
      const bookingId = String(payment?.booking?.id || "").trim();
      const mentorKey = mentorByBookingId[bookingId];
      if (!mentorKey || !mentorHistoryMap[mentorKey]) {
        return;
      }
      mentorHistoryMap[mentorKey].totalSpend += toNumber(payment?.amount);
    });

    const mentorHistory = Object.values(mentorHistoryMap).sort(
      (a, b) =>
        b.totalSpend - a.totalSpend ||
        b.sessionsAttended - a.sessionsAttended ||
        a.name.localeCompare(b.name),
    );

    const totalSessionsAttended = mentorHistory.reduce(
      (sum, mentor) => sum + mentor.sessionsAttended,
      0,
    );
    const totalHoursAttended = mentorHistory.reduce(
      (sum, mentor) => sum + mentor.totalHours,
      0,
    );
    const averageSessionLengthHours =
      totalSessionsAttended > 0
        ? Number((totalHoursAttended / totalSessionsAttended).toFixed(1))
        : 0;

    const acquisitions = {
      organic: Math.min(85, 40 + Math.round(averageProgress * 0.35)),
      referral: 25,
      social: 100,
    };
    acquisitions.social = Math.max(
      8,
      100 - acquisitions.organic - acquisitions.referral,
    );

    const now = new Date();
    const monthBuckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return {
        key: monthKey(date),
        label: new Intl.DateTimeFormat(undefined, { month: "short" }).format(
          date,
        ),
        value: 0,
      };
    });

    const monthIndex = monthBuckets.reduce((acc, bucket, index) => {
      acc[bucket.key] = index;
      return acc;
    }, {});

    (isMentor ? releasedPayments : settledPayments).forEach((payment) => {
      const timestamp = getTime(payment?.updatedAt || payment?.createdAt);
      if (!timestamp) {
        return;
      }
      const date = new Date(timestamp);
      const key = monthKey(date);
      const idx = monthIndex[key];
      if (Number.isInteger(idx)) {
        monthBuckets[idx].value += toNumber(payment?.amount);
      }
    });

    const maxMonthValue = Math.max(
      1,
      ...monthBuckets.map((bucket) => bucket.value),
    );

    return {
      totalAmount: isMentor ? totalEarnings : totalSpent,
      pendingAmount,
      studentsCount: uniqueLearners.size,
      mentorsContacted: uniqueMentors.size,
      sessionsCount: relevantBookings.length,
      hoursLearned: Number(totalHoursLearned.toFixed(1)),
      learnerHistory: {
        totalSessionsAttended,
        averageSessionLengthHours,
        mentors: mentorHistory,
      },
      completionRate,
      averageProgress,
      topSessions,
      acquisitions,
      monthBuckets,
      maxMonthValue,
      avgRating:
        reviews.length > 0
          ? Number(
              (
                reviews.reduce((sum, r) => sum + toNumber(r.rating), 0) /
                reviews.length
              ).toFixed(1),
            )
          : null,
    };
  }, [filtered, isMentor, roadmaps, reviews]);

  const insightCards = useMemo(() => {
    const cards = [];

    if (isMentor) {
      if (analytics.completionRate < 70) {
        cards.push({
          title: "Improve completion rate",
          detail:
            "Send reminders 12 hours before each session to improve attendance.",
          icon: "check_circle",
        });
      }

      if (analytics.pendingAmount > 0) {
        cards.push({
          title: "Revenue waiting to clear",
          detail: `${formatCompactCurrency(analytics.pendingAmount)} is still in held/pending payments.`,
          icon: "schedule",
        });
      }

      cards.push({
        title: "Learning momentum",
        detail: `Average learner progress is ${analytics.averageProgress}%. Prioritize stuck learners this week.`,
        icon: "trending_up",
      });
    } else {
      cards.push({
        title: "Grow your mentor network",
        detail: `You connected with ${analytics.mentorsContacted} mentor${analytics.mentorsContacted === 1 ? "" : "s"} in this window.`,
        icon: "group",
      });

      if (analytics.pendingAmount > 0) {
        cards.push({
          title: "Pending payment updates",
          detail: `${formatCompactCurrency(analytics.pendingAmount)} is still waiting for confirmation.`,
          icon: "schedule",
        });
      }

      cards.push({
        title: "Learning momentum",
        detail: `You completed ${analytics.hoursLearned.toFixed(1)} learning hours with ${analytics.completionRate}% session completion.`,
        icon: "trending_up",
      });
    }

    return cards.slice(0, 3);
  }, [analytics, isMentor]);

  const filteredMentorHistory = useMemo(() => {
    if (isMentor) {
      return [];
    }
    const term = mentorSearch.trim().toLowerCase();
    return analytics.learnerHistory.mentors.filter((mentor) => {
      if (!term) {
        return true;
      }
      return mentor.name.toLowerCase().includes(term);
    });
  }, [analytics.learnerHistory.mentors, isMentor, mentorSearch]);

  const sortedMentorHistory = useMemo(() => {
    const valueSelector = {
      spend: (row) => row.totalSpend,
      sessions: (row) => row.sessionsAttended,
      hours: (row) => row.totalHours,
    };

    const pick = valueSelector[historySortBy] || valueSelector.spend;

    return [...filteredMentorHistory].sort(
      (a, b) =>
        (historySortDirection === "asc"
          ? pick(a) - pick(b)
          : pick(b) - pick(a)) ||
        (historySortDirection === "asc"
          ? a.totalSpend - b.totalSpend
          : b.totalSpend - a.totalSpend) ||
        a.name.localeCompare(b.name),
    );
  }, [filteredMentorHistory, historySortBy, historySortDirection]);

  const handleHistorySort = (sortKey) => {
    setHistorySortBy((current) => {
      if (current === sortKey) {
        setHistorySortDirection((direction) =>
          direction === "asc" ? "desc" : "asc",
        );
        return current;
      }
      setHistorySortDirection("desc");
      return sortKey;
    });
  };

  const getSortIndicator = (sortKey) => {
    if (historySortBy !== sortKey) {
      return "unfold_more";
    }
    return historySortDirection === "asc" ? "arrow_upward" : "arrow_downward";
  };

  const exportLearnerHistoryCsv = () => {
    if (isMentor || sortedMentorHistory.length === 0) {
      return;
    }

    const csvContent = buildLearnerHistoryCsv({
      rangeDays,
      learnerHistory: analytics.learnerHistory,
      mentors: sortedMentorHistory,
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `learner-history-${rangeDays}d.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="md-page">
      <div className="flex min-h-full w-full gap-6">
        <aside className="hidden lg:flex flex-col h-screen w-64 border-r border-slate-200 bg-slate-50 sticky top-0">
          <div className="flex flex-col h-full p-4 space-y-6">
            <div className="flex items-center space-x-3 px-2 py-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined text-2xl">
                  school
                </span>
              </div>
              <div>
                <h2 className="text-lg font-black text-emerald-900 leading-tight">
                  Skill Swapper
                </h2>
                <p className="text-[10px] uppercase tracking-widest text-slate-700 font-bold">
                  Analytics Workspace
                </p>
              </div>
            </div>

            <div className="flex-grow space-y-1">
              <Link
                className="flex items-center space-x-3 px-4 py-3 text-emerald-900 bg-white rounded-lg shadow-sm text-sm font-semibold transition-all"
                to="/wallet"
              >
                <span className="material-symbols-outlined">dashboard</span>
                <span>Overview</span>
              </Link>
              <a
                className="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:text-emerald-800 text-sm font-semibold transition-all"
                href="#sessionTable"
              >
                <span className="material-symbols-outlined">query_stats</span>
                <span>Session Stats</span>
              </a>
              <a
                className="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:text-emerald-800 text-sm font-semibold transition-all"
                href="#acquisition"
              >
                <span className="material-symbols-outlined">trending_up</span>
                <span>Acquisition</span>
              </a>
              <a
                className="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:text-emerald-800 text-sm font-semibold transition-all"
                href="#insights"
              >
                <span className="material-symbols-outlined">insights</span>
                <span>Insights</span>
              </a>
              {!isMentor && (
                <a
                  className="flex items-center space-x-3 px-4 py-3 text-slate-500 hover:bg-slate-100 hover:text-emerald-800 text-sm font-semibold transition-all"
                  href="#learnerHistory"
                >
                  <span className="material-symbols-outlined">history</span>
                  <span>Learner History</span>
                </a>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              {isMentor ? (
                <Link
                  className="w-full inline-flex items-center justify-center bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-xl font-headline font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                  to="/teach"
                >
                  Create Workshop
                </Link>
              ) : (
                <Link
                  className="w-full inline-flex items-center justify-center bg-gradient-to-r from-primary to-primary-container text-on-primary py-3 rounded-xl font-headline font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                  to="/mentors"
                >
                  Find Mentor
                </Link>
              )}
              <Link
                className="flex items-center space-x-3 px-4 py-3 mt-4 text-slate-500 hover:text-emerald-700 transition-colors text-sm font-semibold"
                to={isMentor ? "/mentor/dashboard" : "/learner/dashboard"}
              >
                <span className="material-symbols-outlined">arrow_back</span>
                <span>Back to Dashboard</span>
              </Link>
            </div>
          </div>
        </aside>

        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-6 lg:px-8 lg:pt-6 space-y-8">
            <div className="lg:hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest border border-outline-variant/20 px-4 py-2 text-sm font-semibold"
              >
                <span className="material-symbols-outlined text-base">
                  menu
                </span>
                Open analytics menu
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold tracking-wider uppercase mb-4">
                  Performance Workspace
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tighter">
                  Performance Overview
                </h1>
                <p className="text-on-surface-variant mt-2 font-medium">
                  {isMentor
                    ? "Track sessions, earnings, and learner outcomes with live platform data."
                    : "Track sessions, payments, and learning progress with live platform data."}
                </p>
              </div>
              <div className="flex items-center bg-surface-container-lowest p-1 rounded-xl shadow-sm border border-outline-variant/10 overflow-x-auto w-full md:w-auto">
                {[7, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setRangeDays(days)}
                    className={
                      rangeDays === days
                        ? "px-4 py-2 text-xs font-bold bg-surface-container-low text-primary rounded-lg shadow-sm"
                        : "px-4 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface transition-colors"
                    }
                    type="button"
                  >
                    Last {days} Days
                  </button>
                ))}
              </div>
            </div>

            {errorText && (
              <div className="rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-800 font-medium">
                {errorText}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] border border-transparent hover:border-emerald-900/5 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-900">
                    <span className="material-symbols-outlined">payments</span>
                  </div>
                  <span className="flex items-center text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-1 rounded-full">
                    Live
                  </span>
                </div>
                <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">
                  {isMentor ? "Total Earnings" : "Total Spent"}
                </p>
                <h3 className="text-3xl font-extrabold text-on-surface tracking-tighter">
                  {loading
                    ? "..."
                    : formatCompactCurrency(analytics.totalAmount)}
                </h3>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] border border-transparent">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-900">
                    <span className="material-symbols-outlined">
                      person_add
                    </span>
                  </div>
                  <span className="flex items-center text-blue-600 text-xs font-bold bg-blue-50 px-2 py-1 rounded-full">
                    Active
                  </span>
                </div>
                <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">
                  {isMentor ? "New Students" : "Mentors Contacted"}
                </p>
                <h3 className="text-3xl font-extrabold text-on-surface tracking-tighter">
                  {loading
                    ? "..."
                    : isMentor
                      ? analytics.studentsCount
                      : analytics.mentorsContacted}
                </h3>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] border border-transparent">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-900">
                    <span
                      className="material-symbols-outlined"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                  </div>
                  <span className="text-on-surface-variant text-[10px] font-bold">
                    {isMentor ? "QUALITY SIGNAL" : "LEARNING TIME"}
                  </span>
                </div>
                <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">
                  {isMentor ? "Average Rating" : "Hours Learned"}
                </p>
                <h3 className="text-3xl font-extrabold text-on-surface tracking-tighter">
                  {isMentor ? (
                    <>
                      {loading
                        ? "..."
                        : analytics.avgRating != null
                          ? `${analytics.avgRating}`
                          : "—"}
                      <span className="text-lg text-on-surface-variant font-medium">
                        {analytics.avgRating != null ? "/5.0" : ""}
                      </span>
                    </>
                  ) : (
                    <>
                      {loading ? "..." : analytics.hoursLearned}
                      <span className="text-lg text-on-surface-variant font-medium">
                        h
                      </span>
                    </>
                  )}
                </h3>
              </div>

              <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] border border-transparent">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-900 flex items-center justify-center text-on-primary">
                    <span className="material-symbols-outlined">verified</span>
                  </div>
                  <div className="w-8 h-8 rounded-full border-2 border-primary/20 flex items-center justify-center text-[8px] font-bold">
                    {loading ? "--" : `${analytics.completionRate}%`}
                  </div>
                </div>
                <p className="text-on-surface-variant text-xs font-semibold uppercase tracking-wider mb-1">
                  Completion Rate
                </p>
                <h3 className="text-3xl font-extrabold text-on-surface tracking-tighter">
                  {loading ? "..." : `${analytics.completionRate}%`}
                </h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)]">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      {isMentor ? "Earnings Over Time" : "Spending Over Time"}
                    </h3>
                    <p className="text-on-surface-variant text-xs font-medium">
                      {isMentor
                        ? "Revenue trajectory for the selected window"
                        : "Payment trend for the selected window"}
                    </p>
                  </div>
                </div>
                <div className="relative h-64 w-full">
                  <svg
                    className="w-full h-full"
                    preserveAspectRatio="none"
                    viewBox="0 0 800 220"
                  >
                    <defs>
                      <linearGradient
                        id="gradient-area"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#0c513e"
                          stopOpacity="0.2"
                        />
                        <stop
                          offset="100%"
                          stopColor="#0c513e"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M0,205 ${analytics.monthBuckets
                        .map((bucket, index) => {
                          const x = 60 + index * 145;
                          const y =
                            205 -
                            (bucket.value / analytics.maxMonthValue) * 150;
                          return `L${x},${Math.max(30, y)}`;
                        })
                        .join(" ")} L800,220 L0,220 Z`}
                      fill="url(#gradient-area)"
                    />
                    <polyline
                      points={analytics.monthBuckets
                        .map((bucket, index) => {
                          const x = 60 + index * 145;
                          const y =
                            205 -
                            (bucket.value / analytics.maxMonthValue) * 150;
                          return `${x},${Math.max(30, y)}`;
                        })
                        .join(" ")}
                      fill="none"
                      stroke="#0c513e"
                      strokeLinecap="round"
                      strokeWidth="3"
                    />
                  </svg>
                  <div className="mt-2 grid grid-cols-6 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {analytics.monthBuckets.map((bucket) => (
                      <span key={bucket.label}>{bucket.label}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div
                id="acquisition"
                className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] flex flex-col"
              >
                <h3 className="text-xl font-bold tracking-tight mb-2">
                  Acquisition
                </h3>
                <p className="text-on-surface-variant text-xs font-medium mb-8">
                  {isMentor
                    ? "Where your learners find you"
                    : "How you discover mentors"}
                </p>
                <div className="flex-1 flex flex-col items-center justify-center relative">
                  <div className="w-48 h-48 rounded-full border-[16px] border-surface-container-low relative">
                    <div className="absolute inset-0 rounded-full border-[16px] border-primary border-r-transparent border-b-transparent -m-[16px]" />
                    <div className="absolute inset-0 rounded-full border-[16px] border-tertiary-fixed-dim border-l-transparent border-t-transparent -m-[16px] rotate-45" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-black text-on-surface tracking-tighter">
                        {analytics.acquisitions.organic}%
                      </span>
                      <span className="text-[8px] font-bold text-on-surface-variant uppercase tracking-widest">
                        Organic
                      </span>
                    </div>
                  </div>
                  <div className="mt-6 w-full space-y-2 text-xs font-semibold">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Referral</span>
                      <span>{analytics.acquisitions.referral}%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Social</span>
                      <span>{analytics.acquisitions.social}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div
              id="insights"
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {insightCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-2xl border border-emerald-900/10 bg-surface-container-lowest p-5 shadow-sm"
                >
                  <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-800">
                    <span className="material-symbols-outlined text-base">
                      {card.icon}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-on-surface">
                    {card.title}
                  </h4>
                  <p className="mt-2 text-xs leading-5 text-on-surface-variant">
                    {card.detail}
                  </p>
                </div>
              ))}
            </div>

            {!isMentor && (
              <section
                id="learnerHistory"
                className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] space-y-6"
              >
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      Learner History Details
                    </h3>
                    <p className="text-on-surface-variant text-xs font-medium">
                      Mentors contacted, attendance history, and spend breakdown
                    </p>
                  </div>
                  <div className="text-xs font-semibold text-on-surface-variant">
                    {analytics.learnerHistory.mentors.length} mentor
                    {analytics.learnerHistory.mentors.length === 1
                      ? ""
                      : "s"}{" "}
                    in selected window
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="md:col-span-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Search Mentor
                    </span>
                    <input
                      type="text"
                      value={mentorSearch}
                      onChange={(event) => setMentorSearch(event.target.value)}
                      placeholder="Type mentor name"
                      className="mt-2 w-full rounded-xl border border-outline-variant/20 bg-surface px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Total Sessions Attended
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-on-surface tracking-tight">
                      {loading
                        ? "..."
                        : analytics.learnerHistory.totalSessionsAttended}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-outline-variant/15 bg-surface px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                      Average Session Length
                    </p>
                    <p className="mt-2 text-3xl font-extrabold text-on-surface tracking-tight">
                      {loading
                        ? "..."
                        : analytics.learnerHistory.averageSessionLengthHours}
                      <span className="text-base font-semibold text-on-surface-variant">
                        h
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={exportLearnerHistoryCsv}
                    disabled={loading || sortedMentorHistory.length === 0}
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/20 px-4 py-2 text-xs font-bold uppercase tracking-wide text-on-surface disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-sm">
                      download
                    </span>
                    Export CSV ({rangeDays}d)
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold text-left border-b border-outline-variant/10">
                        <th className="pb-4 font-bold">Mentor</th>
                        <th
                          className="pb-4 font-bold text-right"
                          aria-sort={
                            historySortBy === "sessions"
                              ? historySortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleHistorySort("sessions")}
                            className="inline-flex items-center gap-1 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded"
                            aria-label="Sort by sessions attended"
                          >
                            Sessions Attended
                            <span className="material-symbols-outlined text-sm">
                              {getSortIndicator("sessions")}
                            </span>
                          </button>
                        </th>
                        <th
                          className="pb-4 font-bold text-right"
                          aria-sort={
                            historySortBy === "hours"
                              ? historySortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleHistorySort("hours")}
                            className="inline-flex items-center gap-1 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded"
                            aria-label="Sort by hours learned"
                          >
                            Hours Learned
                            <span className="material-symbols-outlined text-sm">
                              {getSortIndicator("hours")}
                            </span>
                          </button>
                        </th>
                        <th
                          className="pb-4 font-bold text-right"
                          aria-sort={
                            historySortBy === "spend"
                              ? historySortDirection === "asc"
                                ? "ascending"
                                : "descending"
                              : "none"
                          }
                        >
                          <button
                            type="button"
                            onClick={() => handleHistorySort("spend")}
                            className="inline-flex items-center gap-1 hover:text-on-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 rounded"
                            aria-label="Sort by spend"
                          >
                            Spend
                            <span className="material-symbols-outlined text-sm">
                              {getSortIndicator("spend")}
                            </span>
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <tr
                            key={`history-skeleton-${index}`}
                            className={
                              index > 0
                                ? "border-t border-outline-variant/10"
                                : ""
                            }
                          >
                            <td className="py-5">
                              <div className="h-4 w-40 rounded bg-slate-200 animate-pulse" />
                            </td>
                            <td className="py-5 text-right">
                              <div className="ml-auto h-4 w-12 rounded bg-slate-200 animate-pulse" />
                            </td>
                            <td className="py-5 text-right">
                              <div className="ml-auto h-4 w-16 rounded bg-slate-200 animate-pulse" />
                            </td>
                            <td className="py-5 text-right">
                              <div className="ml-auto h-4 w-24 rounded bg-slate-200 animate-pulse" />
                            </td>
                          </tr>
                        ))
                      ) : sortedMentorHistory.length === 0 ? (
                        <tr>
                          <td
                            className="py-6 text-on-surface-variant"
                            colSpan={4}
                          >
                            {mentorSearch.trim()
                              ? `No mentors match "${mentorSearch}" for the selected range.`
                              : "No learner history available for this range yet. Book and complete sessions to build your history."}
                          </td>
                        </tr>
                      ) : (
                        sortedMentorHistory.map((mentor, index) => (
                          <tr
                            key={mentor.id || `${mentor.name}-${index}`}
                            className={
                              index > 0
                                ? "border-t border-outline-variant/10"
                                : ""
                            }
                          >
                            <td className="py-5 font-bold">{mentor.name}</td>
                            <td className="py-5 text-right font-semibold">
                              {mentor.sessionsAttended}
                            </td>
                            <td className="py-5 text-right font-semibold">
                              {mentor.totalHours.toFixed(1)}h
                            </td>
                            <td className="py-5 text-right font-bold text-primary">
                              {formatCurrency(mentor.totalSpend)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div
                id="sessionTable"
                className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] overflow-hidden"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xl font-bold tracking-tight">
                    Recent Top Performing Sessions
                  </h3>
                  <button
                    className="text-primary text-xs font-bold hover:underline"
                    type="button"
                    onClick={() => navigate("/sessions")}
                  >
                    View All Sessions
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold text-left border-b border-outline-variant/10">
                        <th className="pb-4 font-bold">
                          {isMentor ? "Session Name" : "Session"}
                        </th>
                        <th className="pb-4 font-bold">Date</th>
                        <th className="pb-4 font-bold">Status</th>
                        <th className="pb-4 font-bold text-right">
                          {isMentor ? "Revenue" : "Payment"}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <tr
                            key={`sessions-skeleton-${index}`}
                            className={
                              index > 0
                                ? "border-t border-outline-variant/10"
                                : ""
                            }
                          >
                            <td className="py-5">
                              <div className="h-4 w-44 rounded bg-slate-200 animate-pulse" />
                            </td>
                            <td className="py-5">
                              <div className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
                            </td>
                            <td className="py-5">
                              <div className="h-6 w-20 rounded bg-slate-200 animate-pulse" />
                            </td>
                            <td className="py-5 text-right">
                              <div className="ml-auto h-4 w-20 rounded bg-slate-200 animate-pulse" />
                            </td>
                          </tr>
                        ))
                      ) : analytics.topSessions.length === 0 ? (
                        <tr>
                          <td
                            className="py-6 text-on-surface-variant"
                            colSpan={4}
                          >
                            No session data found in this period. Try switching
                            to 30 or 90 days.
                          </td>
                        </tr>
                      ) : (
                        analytics.topSessions.map((session, index) => (
                          <tr
                            key={session.id || `${session.title}-${index}`}
                            className={
                              index > 0
                                ? "border-t border-outline-variant/10"
                                : ""
                            }
                          >
                            <td className="py-5 font-bold">{session.title}</td>
                            <td className="py-5 font-medium text-on-surface-variant">
                              {formatDate(session.date)}
                            </td>
                            <td className="py-5">
                              <span className="px-2 py-1 bg-surface-container-low rounded-lg font-bold text-[10px]">
                                {session.status}
                              </span>
                            </td>
                            <td className="py-5 text-right font-bold text-primary">
                              {formatCurrency(session.amount)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-surface-container-lowest p-8 rounded-3xl shadow-[0px_12px_32px_rgba(17,28,45,0.04)] relative overflow-hidden group">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                  <div>
                    <h3 className="text-xl font-bold tracking-tight">
                      {isMentor
                        ? "Mentor Skill Impact"
                        : "Learning Skill Impact"}
                    </h3>
                    <p className="text-on-surface-variant text-xs font-medium">
                      Progress observed from roadmap milestones and session
                      completion
                    </p>
                  </div>
                  <div className="bg-primary/5 px-3 py-1.5 rounded-full flex items-center space-x-2">
                    <span className="material-symbols-outlined text-xs text-primary">
                      psychology
                    </span>
                    <span className="text-[10px] font-bold text-primary uppercase">
                      Progress Signal
                    </span>
                  </div>
                </div>

                <div className="relative h-64 flex items-center justify-center">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-56 h-56 rounded-full border border-outline-variant/10" />
                    <div className="w-40 h-40 rounded-full border border-outline-variant/10 absolute" />
                    <div className="w-24 h-24 rounded-full border border-outline-variant/10 absolute" />
                    <svg
                      className="w-56 h-56 absolute transform rotate-15"
                      viewBox="0 0 100 100"
                    >
                      <polygon
                        fill="rgba(12, 81, 62, 0.2)"
                        points="50,10 85,35 75,80 30,90 10,40"
                        stroke="#0c513e"
                        strokeWidth="1"
                      />
                      <circle cx="50" cy="10" fill="#0c513e" r="2" />
                      <circle cx="85" cy="35" fill="#0c513e" r="2" />
                      <circle cx="75" cy="80" fill="#0c513e" r="2" />
                      <circle cx="30" cy="90" fill="#0c513e" r="2" />
                      <circle cx="10" cy="40" fill="#0c513e" r="2" />
                    </svg>
                  </div>
                  <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-surface-container-lowest/90 border border-outline-variant/10 px-4 py-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-on-surface-variant font-semibold">
                        Average roadmap completion
                      </span>
                      <span className="font-black text-on-surface">
                        {analytics.averageProgress}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, Math.max(0, analytics.averageProgress))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <footer className="bg-inverse-surface text-inverse-on-surface rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center space-x-6">
                <div className="w-12 h-12 rounded-2xl bg-primary-container flex items-center justify-center">
                  <span className="material-symbols-outlined text-on-primary-container">
                    auto_awesome
                  </span>
                </div>
                <div>
                  <h4 className="text-lg font-bold">
                    {isMentor ? "Revenue Snapshot" : "Payments Snapshot"}
                  </h4>
                  <p className="text-sm text-surface-dim font-medium">
                    {isMentor ? "Released" : "Paid"}:{" "}
                    {formatCurrency(analytics.totalAmount)} | Pending:{" "}
                    {formatCurrency(analytics.pendingAmount)}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <Link
                  className="px-6 py-3 rounded-xl font-headline font-bold text-sm border border-surface-dim/30 hover:bg-white/10 transition-colors"
                  to="/messages"
                >
                  {isMentor ? "Message Learners" : "Message Mentors"}
                </Link>
                {isMentor ? (
                  <Link
                    className="px-6 py-3 rounded-xl font-headline font-bold text-sm bg-primary text-on-primary shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all"
                    to="/teach"
                  >
                    Create Workshop
                  </Link>
                ) : (
                  <Link
                    className="px-6 py-3 rounded-xl font-headline font-bold text-sm bg-primary text-on-primary shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all"
                    to="/mentors"
                  >
                    Find Mentor
                  </Link>
                )}
              </div>
            </footer>
          </div>
        </main>
      </div>

      <div
        className={`fixed inset-0 bg-slate-900/40 z-40 transition-opacity lg:hidden ${mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={() => setMobileSidebarOpen(false)}
      />

      <aside
        className={`fixed left-0 top-0 h-screen w-72 max-w-[85vw] border-r border-slate-200 bg-slate-50 z-50 p-4 space-y-6 transition-transform duration-300 lg:hidden ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-white shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-2xl">school</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-emerald-900 leading-tight">
                Skill Swapper
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                Analytics Workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            className="p-2 text-slate-500"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-1">
          <Link
            className="flex items-center space-x-3 px-4 py-3 text-emerald-900 bg-white rounded-lg shadow-sm text-sm font-semibold transition-all"
            to="/wallet"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span>Overview</span>
          </Link>
          <a
            className="flex items-center space-x-3 px-4 py-3 text-slate-500 text-sm font-semibold transition-all"
            href="#sessionTable"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">query_stats</span>
            <span>Session Stats</span>
          </a>
          <a
            className="flex items-center space-x-3 px-4 py-3 text-slate-500 text-sm font-semibold transition-all"
            href="#acquisition"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">trending_up</span>
            <span>Acquisition</span>
          </a>
          <a
            className="flex items-center space-x-3 px-4 py-3 text-slate-500 text-sm font-semibold transition-all"
            href="#insights"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">insights</span>
            <span>Insights</span>
          </a>
          {!isMentor && (
            <a
              className="flex items-center space-x-3 px-4 py-3 text-slate-500 text-sm font-semibold transition-all"
              href="#learnerHistory"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <span className="material-symbols-outlined">history</span>
              <span>Learner History</span>
            </a>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200">
          <Link
            className="flex items-center space-x-3 px-4 py-3 text-slate-600 hover:text-emerald-700 text-sm font-semibold"
            to={isMentor ? "/mentor/dashboard" : "/learner/dashboard"}
            onClick={() => setMobileSidebarOpen(false)}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>
    </div>
  );
}
