/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- overlay backdrop */
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import Icon from "../modules/common/dashboard/Icon";
import "../modules/mentor/mentor-pages.css";
import "../modules/mentor/reviews-page.css";

const INITIAL_FILTERS = {
  search: "",
  rating: "all",
  recommendation: "all",
  skill: "all",
  session: "all",
  dateRange: "all",
  sort: "newest",
  verifiedOnly: false,
  pendingReply: false,
};

const DATE_RANGE_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 3 months" },
  { value: "custom", label: "Custom range" },
];

const EXPORT_OPTIONS = [
  { value: "csv", label: "Export as CSV", icon: "table_chart" },
  { value: "xlsx", label: "Export as Excel", icon: "grid_on" },
  { value: "pdf", label: "Export as PDF", icon: "picture_as_pdf" },
];

function formatDate(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Animated counter that counts up from 0 to the target value.
 */
function useAnimatedCounter(target, duration = 800, decimals = 0) {
  const [display, setDisplay] = useState(0);
  const prevTarget = useRef(0);
  const frameRef = useRef(null);

  useEffect(() => {
    const startVal = prevTarget.current;
    const endVal = Number(target) || 0;
    if (startVal === endVal) {
      setDisplay(endVal);
      return;
    }
    const startTime = performance.now();
    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * eased;
      setDisplay(decimals > 0 ? current : Math.round(current));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    prevTarget.current = endVal;
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return decimals > 0 ? display.toFixed(decimals) : String(display);
}

/**
 * Render star rating (supports whole numbers 0-5).
 * Uses inline SVG stars to avoid any Unicode rendering issues.
 */
function StarRating({ rating, size = "md" }) {
  const starSize = size === "sm" ? "0.8rem" : "0.95rem";
  return (
    <span className="rpx-review-card__rating" style={{ fontSize: starSize }} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          className={`rpx-star ${star <= rating ? "rpx-star--filled" : ""}`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 20 20" width="1em" height="1em" fill="currentColor">
            <path d="M10 1l2.39 4.84L18 6.36l-3.6 3.52.85 5.02L10 12.69l-4.25 2.21.85-5.02L2 6.36l5.61-.52z" />
          </svg>
        </span>
      ))}
    </span>
  );
}

/**
 * Circular progress chart component
 */
function CircularChart({ value, label, size = 110, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / 5, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="rpx-circular-chart" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="rpx-circular-chart__bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="rpx-circular-chart__fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={0}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <div className="rpx-circular-chart__center">
        <span className="rpx-circular-chart__value">{value}</span>
        <span className="rpx-circular-chart__label">{label}</span>
      </div>
    </div>
  );
}

export default function MentorReviewsPage({ notify }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({
    averageRating: 0,
    totalReviews: 0,
    recommendationRate: 0,
    fiveStarReviews: 0,
    distribution: {},
  });
  const [reviewPage, setReviewPage] = useState(0);
  const [reviewSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [customRange] = useState({ from: "", to: "" });

  const searchTimeoutRef = useRef(null);
  const debounceLoadRef = useRef(null);
  const paginationLoadRef = useRef(null);
  const closeButtonRef = useRef(null);
  const drawerTriggerRef = useRef(null);

  useEffect(() => {
    document.title = "Reviews & Ratings | Mentorly Mentor";
  }, []);

  // Close the Review Details drawer with Escape (matches the AuthModal
  // convention), focus the close button on open, and restore focus to the
  // review card that opened the drawer when it closes — smooth keyboard UX.
  useEffect(() => {
    if (!selectedReview) return;
    const onEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedReview(null);
      }
    };
    document.addEventListener("keydown", onEscape);
    closeButtonRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onEscape);
      drawerTriggerRef.current?.focus?.();
    };
  }, [selectedReview]);

  const buildReviewQueryParams = useCallback(() => {
    const params = {
      page: reviewPage,
      size: reviewSize,
      sort: filters.sort,
    };
    if (filters.search) params.search = filters.search.trim();
    if (filters.rating !== "all") params.rating = filters.rating;
    if (filters.recommendation !== "all")
      params.recommended = filters.recommendation === "recommended";
    if (filters.skill !== "all") params.skill = filters.skill;
    if (filters.session !== "all") params.session = filters.session;
    if (filters.verifiedOnly) params.verifiedOnly = true;
    if (filters.pendingReply) params.pendingReply = true;
    if (filters.dateRange && filters.dateRange !== "all") {
      if (filters.dateRange === "today") {
        params.dateFrom = new Date().toISOString().slice(0, 10);
        params.dateTo = new Date().toISOString().slice(0, 10);
      } else if (filters.dateRange === "custom") {
        if (customRange.from) params.dateFrom = customRange.from;
        if (customRange.to) params.dateTo = customRange.to;
      } else {
        params.dateFrom = new Date(
          Date.now() - Number(filters.dateRange) * 24 * 60 * 60 * 1000,
        )
          .toISOString()
          .slice(0, 10);
        params.dateTo = new Date().toISOString().slice(0, 10);
      }
    }
    return params;
  }, [reviewPage, reviewSize, filters, customRange]);

  const loadReviews = useCallback(async ({ showToast = false, silent = false } = {}) => {
    // silent: true resyncs without the skeleton flash (used after optimistic
    // reply saves so the page updates in place).
    if (!silent) setLoading(true);
    setError(false);
    try {
      const response = await client.get("/api/v1/reviews/mentor", {
        params: buildReviewQueryParams(),
      });
      const data = response?.data?.data || {};
      const items = Array.isArray(data.reviews) ? data.reviews : [];
      setSummary({
        averageRating: Number(data.averageRating || 0),
        totalReviews: Number(data.totalReviews || items.length),
        recommendationRate: Number(data.recommendationRate || 0),
        fiveStarReviews: Number(data.fiveStarReviews || 0),
        distribution: data.distribution || {},
      });
      setReviews(items);
      setTotalPages(Number(data.totalPages || 1));
      if (showToast) {
        notify?.({
          type: "success",
          title: "Reviews updated successfully",
          message: "Latest review data is now displayed.",
        });
      }
    } catch (err) {
      console.error("Failed to load reviews", err);
      setError(true);
      notify?.({
        type: "error",
        title: "Reviews unavailable",
        message:
          err?.response?.data?.message ||
          "We could not load your review data right now.",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildReviewQueryParams, notify]);

  // Keep refs updated so effects always call the latest loadReviews
  debounceLoadRef.current = loadReviews;
  paginationLoadRef.current = loadReviews;

  // Search debounce — uses ref to avoid cascading re-renders from loadReviews dependency
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    const timeout = setTimeout(() => {
      if (reviewPage !== 0) {
        setReviewPage(0);
      } else {
        debounceLoadRef.current?.();
      }
    }, 300);
    searchTimeoutRef.current = timeout;
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters.search,
    filters.rating,
    filters.recommendation,
    filters.skill,
    filters.session,
    filters.dateRange,
    filters.sort,
    filters.verifiedOnly,
    filters.pendingReply,
    customRange,
  ]);

  // Pagination — uses ref to avoid stale closures
  useEffect(() => {
    paginationLoadRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewPage, reviewSize]);

  const refreshReviews = useCallback(async () => {
    setRefreshing(true);
    await loadReviews({ showToast: true });
  }, [loadReviews]);

  const isReviewRecommended = (review) => {
    if (review?.recommended !== undefined) return Boolean(review.recommended);
    if (review?.rating !== undefined) return Number(review.rating) >= 4;
    const recommendation = String(review?.recommendation || "").toLowerCase();
    return ["recommended", "yes", "true", "y"].includes(recommendation);
  };

  const reviewRecommendationLabel = (review) =>
    isReviewRecommended(review) ? "Recommended" : "Not recommended";

  const reviewDatesMatchRange = useCallback((reviewDate, rangeKey) => {
    if (!reviewDate || !rangeKey || rangeKey === "all") return true;
    const date = new Date(reviewDate);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    if (rangeKey === "today") {
      return date.toDateString() === now.toDateString();
    }
    if (rangeKey === "custom") {
      if (!customRange.from || !customRange.to) return true;
      const from = new Date(customRange.from);
      const to = new Date(customRange.to);
      return date >= from && date <= to;
    }
    const days = Number(rangeKey);
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return date >= cutoff;
  }, [customRange]);

  const filteredReviews = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return reviews.filter((review) => {
      const matchesSearch =
        !term ||
        [
          review.learnerName,
          review.comment,
          review.sessionTitle,
          review.skillName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesRating =
        filters.rating === "all" || String(review.rating) === filters.rating;
      const matchesRecommendation =
        filters.recommendation === "all" ||
        (filters.recommendation === "recommended" &&
          isReviewRecommended(review)) ||
        (filters.recommendation === "notRecommended" &&
          !isReviewRecommended(review));
      const matchesSkill =
        filters.skill === "all" || review.skillName === filters.skill;
      const matchesDate = reviewDatesMatchRange(
        review.createdAt,
        filters.dateRange,
      );
      return (
        matchesSearch &&
        matchesRating &&
        matchesRecommendation &&
        matchesSkill &&
        matchesDate
      );
    });
  }, [filters, reviews, reviewDatesMatchRange]);

  const sortedReviews = useMemo(() => {
    const list = [...filteredReviews];
    list.sort((a, b) => {
      const dateCompare =
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime();
      const ratingCompare = Number(b.rating || 0) - Number(a.rating || 0);
      const helpfulCompare =
        Number(b.helpfulCount || 0) - Number(a.helpfulCount || 0);
      if (filters.sort === "oldest") return -dateCompare;
      if (filters.sort === "highest") return ratingCompare || -dateCompare;
      if (filters.sort === "lowest") return -ratingCompare || dateCompare;
      if (filters.sort === "mostHelpful") return helpfulCompare || -dateCompare;
      if (filters.sort === "leastHelpful")
        return -helpfulCompare || dateCompare;
      return dateCompare;
    });
    return list;
  }, [filteredReviews, filters.sort]);

  const skillOptions = useMemo(() => {
    const skills = new Set(
      reviews.map((review) => review.skillName).filter(Boolean),
    );
    return Array.from(skills).sort();
  }, [reviews]);

  const sessionOptions = useMemo(() => {
    const sessions = new Set(
      reviews.map((review) => review.sessionTitle).filter(Boolean),
    );
    return Array.from(sessions).sort();
  }, [reviews]);

  // Top skills reviewed — derived from the real review data (each review is
  // attached to the session/skill it was written for). Falls back to an empty
  // state when the data has no skill breakdown.
  const topSkills = useMemo(() => {
    const counts = new Map();
    reviews.forEach((review) => {
      const name = (review.skillName || "").trim();
      if (!name) return;
      counts.set(name, (counts.get(name) || 0) + 1);
    });
    const total = reviews.length || 1;
    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        pct: Math.min(100, Math.round((count / total) * 100)),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5);
  }, [reviews]);

  // Dynamic status captions for the hero stat cards (never hardcoded values).
  const ratingStatus = useMemo(() => {
    const avg = Number(summary.averageRating) || 0;
    if (avg >= 4.5) return { label: "Excellent", tone: "excellent" };
    if (avg >= 4) return { label: "Good", tone: "good" };
    if (avg >= 3) return { label: "Fair", tone: "fair" };
    return { label: "Needs work", tone: "needs" };
  }, [summary.averageRating]);

  const recommendationStatus = useMemo(() => {
    const rate = Number(summary.recommendationRate) || 0;
    if (rate >= 80) return { label: "Excellent", tone: "excellent" };
    if (rate >= 60) return { label: "Good", tone: "good" };
    return { label: "Needs work", tone: "needs" };
  }, [summary.recommendationRate]);

  const ratingBreakdown = useMemo(() => {
    const list = [5, 4, 3, 2, 1];
    return list.map((star) => ({
      star,
      count: Number(summary.distribution?.[star] || 0),
      width: summary.totalReviews
        ? clamp(
            Math.round(
              (Number(summary.distribution?.[star] || 0) /
                summary.totalReviews) *
                100,
            ),
            0,
            100,
          )
        : 0,
    }));
  }, [summary]);

  const animatedAvgRating = useAnimatedCounter(summary.averageRating, 1000, 1);
  const animatedTotalReviews = useAnimatedCounter(summary.totalReviews, 1000);
  const animatedRecRate = useAnimatedCounter(summary.recommendationRate, 1000);

  const openReview = (review) => {
    drawerTriggerRef.current = document.activeElement;
    setSelectedReview(review);
    setReplyDraft(review.replyText || "");
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!selectedReview?.id) return;
    const trimmedReply = replyDraft.trim();

    // ── Optimistic update: update UI immediately ──
    setReplying(true);
    const previousReviews = [...reviews];
    const previousSelected = { ...selectedReview };

    setReviews((prev) =>
      prev.map((r) =>
        r.id === selectedReview.id ? { ...r, replyText: trimmedReply } : r,
      ),
    );
    setSelectedReview((prev) =>
      prev ? { ...prev, replyText: trimmedReply } : prev,
    );

    try {
      await client.post(`/api/v1/reviews/${selectedReview.id}/reply`, {
        replyText: trimmedReply,
      });
      notify?.({
        type: "success",
        title: "Reply saved",
        message: "Your response is now visible to the learner.",
      });
      // Silent background sync — keeps the list authoritative without the
      // skeleton flash.
      loadReviews({ silent: true }).catch(() => null);
    } catch (err) {
      // ── Surgical rollback: restore ONLY this review so a concurrent
      // refresh isn't clobbered, and never re-open a closed drawer. ──
      const originalReview = previousReviews.find(
        (r) => r.id === selectedReview.id,
      );
      if (originalReview) {
        setReviews((prev) =>
          prev.map((r) => (r.id === selectedReview.id ? originalReview : r)),
        );
      }
      setSelectedReview((prev) =>
        prev && prev.id === selectedReview.id ? previousSelected : prev,
      );
      notify?.({
        type: "error",
        title: "Reply failed",
        message: err?.response?.data?.message || "Please try again.",
      });
    } finally {
      setReplying(false);
    }
  };

  const buildExportRows = (items) =>
    items.map((review) => ({
      "Student Name": review.learnerName || "",
      "Session Name": review.sessionTitle || "",
      Rating: review.rating || 0,
      Review: review.comment || "",
      Recommendation: reviewRecommendationLabel(review),
      Skill: review.skillName || "",
      Date: formatDate(review.createdAt),
      "Mentor Reply": review.replyText || "",
    }));

  const exportCsv = (items) => {
    const rows = buildExportRows(items);
    const header = Object.keys(rows[0] || {}).join(",");
    const csvContent = [
      header,
      ...rows.map((row) =>
        Object.values(row)
          .map((cell) => `"${String(cell || "").replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mentor-reviews-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportXlsx = async (items) => {
    const ExcelJS = (await import("exceljs")).default;
    const rows = buildExportRows(items);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Mentorly";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet("Reviews", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    const headers = Object.keys(rows[0] || {});
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(header.length + 5, 18),
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
    headerRow.alignment = { vertical: "middle", horizontal: "center" };
    headerRow.height = 28;

    const dataRows = rows.map((row) => Object.values(row));
    worksheet.addRows(dataRows);

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mentor-reviews-${new Date().toISOString().slice(0, 10)}.xlsx`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const exportPdf = async (items) => {
    const { default: jsPDF } = await import("jspdf");
    await import("jspdf-autotable");
    const rows = buildExportRows(items);
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Mentor Reviews", 14, 16);
    const body = rows.map((row) => Object.values(row));
    doc.autoTable({
      startY: 22,
      head: [Object.keys(rows[0] || {})],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      margin: { left: 14, right: 14 },
    });
    doc.save(`mentor-reviews-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const fetchExportReviews = async () => {
    const params = {
      ...buildReviewQueryParams(),
      page: 0,
      size: Math.max(1000, summary.totalReviews || reviewSize),
    };
    const response = await client.get("/api/v1/reviews/mentor", { params });
    const data = response?.data?.data || {};
    return Array.isArray(data.reviews) ? data.reviews : [];
  };

  const handleExport = async (type) => {
    try {
      const exportReviews = await fetchExportReviews();
      if (!exportReviews.length) {
        notify?.({
          type: "error",
          title: "No reviews to export",
          message: "Adjust filters before exporting.",
        });
        return;
      }
      if (type === "csv") exportCsv(exportReviews);
      if (type === "xlsx") await exportXlsx(exportReviews);
      if (type === "pdf") await exportPdf(exportReviews);
      notify?.({
        type: "success",
        title: "Export ready",
        message: `Your ${type.toUpperCase()} report is downloading.`,
      });
    } catch (err) {
      console.error(err);
      notify?.({
        type: "error",
        title: "Export failed",
        message:
          err?.response?.data?.message || "Could not generate the report.",
      });
    } finally {
      setExportMenuOpen(false);
    }
  };

  const hasActiveFilters =
    filters.rating !== "all" ||
    filters.recommendation !== "all" ||
    filters.skill !== "all" ||
    filters.session !== "all" ||
    filters.dateRange !== "all" ||
    filters.sort !== "newest" ||
    filters.verifiedOnly ||
    filters.pendingReply ||
    filters.search.trim() !== "";

  const renderResultCount = () => {
    if (loading || error) return null;
    const total = reviews.length;
    const showing = sortedReviews.length;
    if (total === 0) return null;
    if (showing === total) {
      return (
        <span className="rpx-filters__count">
          {total} review{total !== 1 ? "s" : ""}
        </span>
      );
    }
    return (
      <span className="rpx-filters__count">
        Showing {showing} of {total}
      </span>
    );
  };

  return (
    <main className="md md-page rpx-root">
      <div className="rpx-container">
        {/* ═══════════════════════════════════════════════════════
            COMPACT HERO — badge, heading, actions, stat column
            ═══════════════════════════════════════════════════════ */}
        <HeroSection
          className="hero-section--compact hero-section--reviews"
          badge={
            <>
              <Icon name="star" /> Reputation
            </>
          }
          title="Reviews & Ratings"
          subtitle="Track your teaching reputation, monitor learner satisfaction, and improve your mentoring quality."
          secondaryButton={
            <button
              className="hero-section__btn hero-section__btn--secondary"
              type="button"
              onClick={refreshReviews}
              disabled={refreshing}
            >
              <Icon name="refresh" />
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          }
          primaryButton={
            <div className="rpx-export-group" style={{ position: "relative" }}>
              <button
                className="hero-section__btn hero-section__btn--primary"
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                <Icon name="download" />
                Export
              </button>
              {exportMenuOpen && (
                <div className="rpx-export-menu">
                  {EXPORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className="rpx-export-menu__item"
                      type="button"
                      onClick={() => handleExport(option.value)}
                    >
                      <Icon name={option.icon} />
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          }
          floatingCards={
            <div className="rpx-hero-stats">
              <div className="rpx-hero-stat">
                <span className="rpx-hero-stat__icon">
                  <Icon name="star" />
                </span>
                <div className="rpx-hero-stat__info">
                  {loading ? (
                    <span className="rpx-hero-stat__skeleton" aria-hidden="true" />
                  ) : (
                    <span className="rpx-hero-stat__value">{animatedAvgRating}</span>
                  )}
                  <span className="rpx-hero-stat__label">Average Rating</span>
                  {!loading && (
                    <span className={`rpx-hero-stat__status rpx-hero-stat__status--${ratingStatus.tone}`}>
                      {ratingStatus.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="rpx-hero-stat">
                <span className="rpx-hero-stat__icon">
                  <Icon name="forum" />
                </span>
                <div className="rpx-hero-stat__info">
                  {loading ? (
                    <span className="rpx-hero-stat__skeleton" aria-hidden="true" />
                  ) : (
                    <span className="rpx-hero-stat__value">{animatedTotalReviews}</span>
                  )}
                  <span className="rpx-hero-stat__label">Total Reviews</span>
                  {!loading && (
                    <span className="rpx-hero-stat__status rpx-hero-stat__status--muted">
                      All Time
                    </span>
                  )}
                </div>
              </div>

              <div className="rpx-hero-stat">
                <span className="rpx-hero-stat__icon">
                  <Icon name="workspace_premium" />
                </span>
                <div className="rpx-hero-stat__info">
                  {loading ? (
                    <span className="rpx-hero-stat__skeleton" aria-hidden="true" />
                  ) : (
                    <span className="rpx-hero-stat__value">{animatedRecRate}%</span>
                  )}
                  <span className="rpx-hero-stat__label">Recommendation Rate</span>
                  {!loading && (
                    <span className={`rpx-hero-stat__status rpx-hero-stat__status--${recommendationStatus.tone}`}>
                      {recommendationStatus.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          }
        />

        {/* ═══════════════════════════════════════════════════════
            FILTER TOOLBAR
            ═══════════════════════════════════════════════════════ */}
        <div className="rpx-filters">
          <div className="rpx-filters__row">
            <label className="rpx-search">
              <Icon name="search" />
              <input
                value={filters.search}
                placeholder="Search reviews\u2026"
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, search: event.target.value }))
                }
              />
            </label>
            <select
              className="rpx-select"
              value={filters.rating}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, rating: event.target.value }))
              }
              aria-label="Filter by rating"
            >
              <option value="all">All Ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
            <select
              className="rpx-select"
              value={filters.skill}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, skill: event.target.value }))
              }
              aria-label="Filter by skill"
            >
              <option value="all">All Skills</option>
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <select
              className="rpx-select rpx-select--sort"
              value={filters.sort}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sort: event.target.value }))
              }
              aria-label="Sort reviews"
            >
              <option value="newest">Most Recent</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest Rating</option>
              <option value="lowest">Lowest Rating</option>
              <option value="mostHelpful">Most Helpful</option>
              <option value="leastHelpful">Least Helpful</option>
            </select>
            <select
              className="rpx-select rpx-select--wide"
              value={filters.recommendation}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  recommendation: event.target.value,
                }))
              }
              aria-label="Filter by recommendation"
            >
              <option value="all">Recommendation</option>
              <option value="recommended">Recommended</option>
              <option value="notRecommended">Not recommended</option>
            </select>
            <select
              className="rpx-select"
              value={filters.session}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, session: event.target.value }))
              }
              aria-label="Filter by session"
            >
              <option value="all">All Sessions</option>
              {sessionOptions.map((session) => (
                <option key={session} value={session}>
                  {session}
                </option>
              ))}
            </select>
            <select
              className="rpx-select"
              value={filters.dateRange}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, dateRange: event.target.value }))
              }
              aria-label="Filter by date range"
            >
              {DATE_RANGE_OPTIONS.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
            <label className={`rpx-toggle ${filters.verifiedOnly ? "rpx-toggle--active" : ""}`}>
              <input
                type="checkbox"
                checked={filters.verifiedOnly}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    verifiedOnly: !prev.verifiedOnly,
                  }))
                }
              />
              <span>Verified</span>
            </label>
            <label className={`rpx-toggle ${filters.pendingReply ? "rpx-toggle--active" : ""}`}>
              <input
                type="checkbox"
                checked={filters.pendingReply}
                onChange={() =>
                  setFilters((prev) => ({
                    ...prev,
                    pendingReply: !prev.pendingReply,
                  }))
                }
              />
              <span>Pending reply</span>
            </label>
            <div className="rpx-filters__actions">
              {hasActiveFilters && (
                <button
                  className="rpx-clear-btn"
                  type="button"
                  onClick={() => setFilters(INITIAL_FILTERS)}
                >
                  <Icon name="close" />
                  Clear filters
                </button>
              )}
              {renderResultCount()}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            MAIN LAYOUT: Review Feed + Sidebar
            ═══════════════════════════════════════════════════════ */}
        <div className="rpx-layout">
          {/* ── LEFT COLUMN: Review Feed ── */}
          <section className="rpx-feed">
            {loading ? (
              <div className="rpx-skeleton-list rpx-animate-stagger">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="rpx-skeleton-card"
                  />
                ))}
              </div>
            ) : error ? (
              <div className="rpx-error">
                <div className="rpx-error__icon">
                  <Icon name="error" />
                </div>
                <p className="rpx-error__title">
                  Unable to load reviews
                </p>
                <p className="rpx-error__desc">
                  Something went wrong while loading your reviews.
                </p>
                <button
                  type="button"
                  className="rpx-empty__btn rpx-empty__btn--outline"
                  style={{ marginTop: 4 }}
                  onClick={() => loadReviews()}
                >
                  <Icon name="refresh" /> Try Again
                </button>
              </div>
            ) : sortedReviews.length === 0 ? (
              <div className="rpx-empty">
                <div className="rpx-empty__illustration">
                  <Icon name="reviews" />
                  <div className="rpx-empty__illustration-stars" aria-hidden="true">
                    <Icon name="star_rate" /> <Icon name="star_rate" /> <Icon name="star_rate" />
                  </div>
                </div>
                <p className="rpx-empty__title">
                  {reviews.length === 0
                    ? "No reviews yet"
                    : "No reviews match your filters"}
                </p>
                <p className="rpx-empty__desc">
                  {reviews.length === 0
                    ? "Reviews from learners will appear here after completed sessions. Your reviews will help learners understand your mentoring experience."
                    : "Try adjusting your filters to find what you're looking for."}
                </p>
                {reviews.length === 0 ? (
                  <div className="rpx-empty__actions">
                    <button
                      type="button"
                      className="rpx-empty__btn rpx-empty__btn--primary"
                      onClick={() => navigate("/mentor/calendar")}
                    >
                      <Icon name="add" /> Create a Session
                    </button>
                    <button
                      type="button"
                      className="rpx-empty__btn rpx-empty__btn--outline"
                      onClick={() => navigate("/mentor/settings")}
                    >
                      <Icon name="share" /> Share Profile
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="rpx-empty__btn rpx-empty__btn--outline"
                    onClick={() => setFilters(INITIAL_FILTERS)}
                  >
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {sortedReviews.map((review, index) => (
                  <article
                    key={review.id}
                    className="rpx-review-card"
                    tabIndex={-1}
                    onClick={() => openReview(review)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {/* Card Header */}
                    <div className="rpx-review-card__head">
                      <div className="rpx-review-card__user">
                        <div className="rpx-review-card__avatar">
                          {review.learnerProfileImageUrl ? (
                            <img
                              src={review.learnerProfileImageUrl}
                              alt=""
                            />
                          ) : (
                            (review.learnerName || "L").charAt(0)
                          )}
                        </div>
                        <div className="rpx-review-card__info">
                          <div className="rpx-review-card__name">
                            {review.learnerName || "Learner"}
                          </div>
                          <div className="rpx-review-card__meta">
                            <span>{formatDate(review.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <StarRating rating={review.rating || 0} />
                    </div>

                    {/* Recommendation status */}
                    <div className="rpx-review-card__rec-row">
                      <span className={
                        `rpx-badge-rec ${
                          isReviewRecommended(review)
                            ? "rpx-badge-rec--yes"
                            : "rpx-badge-rec--no"
                        }`
                      }>
                        <Icon name={
                          isReviewRecommended(review)
                            ? "check_circle"
                            : "info"
                        } />
                        {reviewRecommendationLabel(review)}
                      </span>
                      {review.skillName && (
                        <span className="rpx-tag">
                          <Icon name="tag" />
                          {review.skillName}
                        </span>
                      )}
                    </div>

                    {/* Card Body */}
                    <div className="rpx-review-card__body">
                      <div className="rpx-review-card__feedback-label">
                        <Icon name="chat" /> Learner feedback
                      </div>
                      <p className="rpx-review-card__text">
                        {review.comment || "No written feedback provided."}
                      </p>

                      {/* Mentor reply preview */}
                      {review.replyText && (
                        <div className="rpx-review-card__reply">
                          <div className="rpx-review-card__reply-label">
                            <Icon name="reply" /> Your reply
                          </div>
                          <p className="rpx-review-card__reply-text">
                            {review.replyText}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Card Footer */}
                    <div className="rpx-review-card__footer">
                      <span className="rpx-review-card__helpful">
                        <Icon name="thumb_up" />
                        Helpful • {review.helpfulCount || 0}
                      </span>
                      <div className="rpx-review-card__actions">
                        <button
                          className="rpx-icon-btn"
                          type="button"
                          title="Reply to this review"
                          onClick={(event) => {
                            event.stopPropagation();
                            openReview(review);
                          }}
                        >
                          <Icon name="reply" />
                        </button>
                        <button
                          className="rpx-icon-btn"
                          type="button"
                          title="View student"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/mentor/students`);
                          }}
                        >
                          <Icon name="person" />
                        </button>
                        <button
                          className="rpx-icon-btn"
                          type="button"
                          title="Go to teaching page"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/mentor/teach`);
                          }}
                        >
                          <Icon name="event_note" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}

                {/* Pagination */}
                <div className="rpx-pagination">
                  <button
                    className="rpx-pagination__btn"
                    type="button"
                    disabled={reviewPage <= 0}
                    onClick={() =>
                      setReviewPage((page) => Math.max(0, page - 1))
                    }
                  >
                    <Icon name="chevron_left" /> Previous
                  </button>
                  <span className="rpx-pagination__info">
                    Page {Math.min(reviewPage + 1, totalPages || 1)} of{" "}
                    {Math.max(totalPages, 1)}
                  </span>
                  <button
                    className="rpx-pagination__btn"
                    type="button"
                    disabled={reviewPage >= totalPages - 1}
                    onClick={() =>
                      setReviewPage((page) =>
                        Math.min(totalPages - 1, page + 1),
                      )
                    }
                  >
                    Next <Icon name="chevron_right" />
                  </button>
                </div>
              </>
            )}
          </section>

          {/* ── RIGHT COLUMN: Sticky Sidebar ── */}
          <aside className="rpx-sidebar">
            {/* Overall Rating */}
            <div className="rpx-sidebar-card">
              <div className="rpx-sidebar-card__head">
                <h2 className="rpx-sidebar-card__title">
                  <Icon name="star_rate" /> Overall Rating
                </h2>
              </div>
              {loading ? (
                <div className="rpx-skeleton-sidebar" aria-hidden="true">
                  <span className="rpx-skeleton-sidebar__ring" />
                  <span className="rpx-skeleton-sidebar__line" />
                  <span className="rpx-skeleton-sidebar__line" />
                </div>
              ) : (
                <>
                  <div className="rpx-overall-rating">
                    <CircularChart
                      value={Number(summary.averageRating).toFixed(1)}
                      label="out of 5"
                    />
                  </div>
                  <div className="rpx-rating-dist">
                    {ratingBreakdown.map((item) => {
                      const pct = summary.totalReviews
                        ? Math.round(
                            ((Number(summary.distribution?.[item.star] || 0) /
                              summary.totalReviews) *
                              100),
                          )
                        : 0;
                      return (
                        <div key={item.star} className="rpx-rating-row">
                          <span className="rpx-rating-row__label">
                            {Array.from({ length: item.star }, (_, i) => (
                              <Icon key={i} name="star_rate" />
                            ))}
                          </span>
                          <div className="rpx-rating-row__track">
                            <div
                              className="rpx-rating-row__fill"
                              style={{ width: `${item.width}%` }}
                            />
                          </div>
                          <span className="rpx-rating-row__count">
                            {item.count} ({pct}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Top Skills Reviewed */}
            <div className="rpx-sidebar-card">
              <div className="rpx-sidebar-card__head">
                <h2 className="rpx-sidebar-card__title">
                  <Icon name="workspace_premium" /> Top Skills Reviewed
                </h2>
              </div>
              {loading ? (
                <div className="rpx-skeleton-sidebar" aria-hidden="true">
                  <span className="rpx-skeleton-sidebar__line" />
                  <span className="rpx-skeleton-sidebar__line" />
                  <span className="rpx-skeleton-sidebar__line" />
                </div>
              ) : topSkills.length === 0 ? (
                <div className="rpx-skills-empty">
                  <span className="rpx-skills-empty__icon">
                    <Icon name="auto_awesome" />
                  </span>
                  <p className="rpx-skills-empty__title">No skill insights yet</p>
                  <p className="rpx-skills-empty__desc">
                    Skill breakdowns appear once learners review your sessions.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rpx-skills-list">
                    {topSkills.map((skill) => (
                      <div key={skill.name} className="rpx-skill-item">
                        <div className="rpx-skill-item__info">
                          <span className="rpx-skill-item__name">{skill.name}</span>
                          <div className="rpx-skill-item__bar">
                            <div
                              className="rpx-skill-item__fill"
                              style={{ width: `${skill.pct}%` }}
                            />
                          </div>
                        </div>
                        <span className="rpx-skill-item__pct">{skill.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="rpx-skills-link"
                    onClick={() => navigate("/mentor/professional-profile")}
                  >
                    View all skills <Icon name="chevron_right" />
                  </button>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          DRAWER: Review Detail + Reply Form
          ═══════════════════════════════════════════════════════ */}
      {selectedReview && (
        <div
          className="rpx-overlay"
          onClick={() => setSelectedReview(null)}
          role="presentation"
        >
          <div
            className="rpx-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rpx-drawer__head">
              <div className="rpx-drawer__head-main">
                <h3 className="rpx-drawer__title">Review details</h3>
                <p className="rpx-drawer__sub">
                  {selectedReview.learnerName || "Learner"}
                </p>
              </div>
              <button
                ref={closeButtonRef}
                className="rpx-drawer__close"
                type="button"
                onClick={() => setSelectedReview(null)}
                title="Close"
                aria-label="Close review details"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="rpx-drawer__body">
              {/* Info Grid */}
              <div className="rpx-drawer-info">
                <div className="rpx-drawer-info__item">
                  <p className="rpx-drawer-info__key">Skill</p>
                  <p className="rpx-drawer-info__value">
                    {selectedReview.skillName || "General"}
                  </p>
                </div>
                <div className="rpx-drawer-info__item">
                  <p className="rpx-drawer-info__key">Session</p>
                  <p className="rpx-drawer-info__value">
                    {selectedReview.sessionTitle || "Session"}
                  </p>
                </div>
                <div className="rpx-drawer-info__item">
                  <p className="rpx-drawer-info__key">Date</p>
                  <p className="rpx-drawer-info__value">
                    {formatDate(selectedReview.createdAt)}
                  </p>
                </div>
                <div className="rpx-drawer-info__item">
                  <p className="rpx-drawer-info__key">Rating</p>
                  <p className="rpx-drawer-info__value">
                    <StarRating rating={selectedReview.rating || 0} size="sm" />
                  </p>
                </div>
              </div>

              {/* Learner feedback */}
              <div className="rpx-drawer-block">
                <span className="rpx-drawer-block__label">
                  <Icon name="chat" /> Learner feedback
                </span>
                <p className="rpx-drawer-block__text">
                  {selectedReview.comment || "No written feedback provided."}
                </p>
              </div>

              {/* Mentor reply */}
              <div className="rpx-drawer-block">
                <span className="rpx-drawer-block__label">
                  <Icon name="reply" /> Mentor reply
                </span>
                <p className="rpx-drawer-block__text">
                  {selectedReview.replyText || "No reply yet."}
                </p>
              </div>

              {/* Reply form */}
              <form className="rpx-reply-form" onSubmit={submitReply}>
                <textarea
                  className="rpx-reply-form__textarea"
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder="Write a thoughtful reply to this learner\u2026"
                />
                <button
                  className="rpx-reply-form__btn"
                  type="submit"
                  disabled={replying}
                >
                  {replying ? "Saving\u2026" : "Reply to review"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
