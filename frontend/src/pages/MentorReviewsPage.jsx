/* eslint-disable jsx-a11y/no-noninteractive-element-interactions -- overlay backdrop */
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "../modules/mentor/mentor-pages.css";
import "../modules/mentor/reviews-page.css";
import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import "jspdf-autotable";

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

const TOP_SKILLS = [
  { name: "Communication", pct: 92, color: "teal" },
  { name: "Knowledge", pct: 88, color: "blue" },
  { name: "Problem Solving", pct: 85, color: "purple" },
  { name: "Interview Guidance", pct: 80, color: "pink" },
  { name: "Projects", pct: 78, color: "orange" },
];

const IMPROVEMENTS = [
  "Provide more assignments",
  "Increase session duration",
  "Share notes after sessions",
  "Improve microphone quality",
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

  useEffect(() => {
    document.title = "Reviews & Ratings | SkillSwap Mentor";
  }, []);

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

  const loadReviews = useCallback(async ({ showToast = false } = {}) => {
    setLoading(true);
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
      // Background sync with backend (non-blocking)
      loadReviews().catch(() => null);
    } catch (err) {
      // Roll back optimistic update on failure
      setReviews(previousReviews);
      setSelectedReview(previousSelected);
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
    const rows = buildExportRows(items);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "SkillSwap";
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

  const exportPdf = (items) => {
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
      if (type === "pdf") exportPdf(exportReviews);
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
            PREMIUM HERO SECTION with embedded stats
            ═══════════════════════════════════════════════════════ */}
        <section className="rpx-hero" aria-label="Reviews overview">
          {/* Background blobs */}
          <div className="rpx-hero__bg" aria-hidden="true">
            <div className="rpx-hero__blob rpx-hero__blob--1" />
            <div className="rpx-hero__blob rpx-hero__blob--2" />
            <div className="rpx-hero__blob rpx-hero__blob--3" />
          </div>

          {/* Geometric pattern */}
          <div className="rpx-hero__pattern" aria-hidden="true">
            <svg viewBox="0 0 400 200" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
              <circle cx="360" cy="40" r="100" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
              <circle cx="280" cy="160" r="140" stroke="currentColor" strokeWidth="0.5" opacity="0.10" />
              <rect x="320" y="80" width="50" height="50" rx="10" stroke="currentColor" strokeWidth="0.5" opacity="0.12" />
              <circle cx="60" cy="30" r="60" stroke="currentColor" strokeWidth="0.5" opacity="0.10" />
            </svg>
          </div>

          {/* Floating illustration */}
          <div className="rpx-hero__illustration" aria-hidden="true">
            <Icon name="reviews" />
            <div className="rpx-hero__illustration-stars" aria-hidden="true">
              <Icon name="star_rate" /> <Icon name="star_rate" /> <Icon name="star_rate" /> <Icon name="star_rate" /> <Icon name="star_rate" />
            </div>
          </div>

          {/* Top row: title + actions */}
          <div className="rpx-hero__top">
            <div className="rpx-hero__left">
              <div className="rpx-hero__eyebrow">
                <Icon name="star" /> Reputation
              </div>
              <h1 className="rpx-hero__title">Reviews &amp; Ratings</h1>
              <p className="rpx-hero__sub">
                Track your teaching reputation, monitor learner satisfaction,
                and improve your mentoring quality.
              </p>
            </div>
            <div className="rpx-hero__right">
              <button
                className="rpx-hero__btn"
                type="button"
                onClick={refreshReviews}
                disabled={refreshing}
              >
                <Icon name="refresh" />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
              <div className="rpx-export-group">
                <button
                  className="rpx-hero__btn rpx-hero__btn--primary"
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
            </div>
          </div>

          {/* Stats row inside hero */}
          <div className="rpx-hero-stats">
            <div className="rpx-hero-stat">
              <div className="rpx-hero-stat__icon">
                <Icon name="star_rate" />
              </div>
              <div className="rpx-hero-stat__info">
                <span className="rpx-hero-stat__value">
                  {animatedAvgRating}
                </span>
                <span className="rpx-hero-stat__label">
                  Average Rating
                </span>
              </div>
            </div>
            <div className="rpx-hero-stat">
              <div className="rpx-hero-stat__icon">
                <Icon name="forum" />
              </div>
              <div className="rpx-hero-stat__info">
                <span className="rpx-hero-stat__value">
                  {animatedTotalReviews}
                </span>
                <span className="rpx-hero-stat__label">
                  Total Reviews
                </span>
              </div>
            </div>
            <div className="rpx-hero-stat">
              <div className="rpx-hero-stat__icon">
                <Icon name="thumb_up" />
              </div>
              <div className="rpx-hero-stat__info">
                <span className="rpx-hero-stat__value">
                  {animatedRecRate}%
                </span>
                <span className="rpx-hero-stat__label">
                  Recommendation Rate
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════
            FILTERS CARD
            ═══════════════════════════════════════════════════════ */}
        <div className="rpx-filters">
          <div className="rpx-filters__row">
            <label className="rpx-search">
              <Icon name="search" />
              <input
                value={filters.search}
                placeholder="Search reviews by learner, skill, or comment\u2026"
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
              <option value="all">All ratings</option>
              <option value="5">5 stars</option>
              <option value="4">4 stars</option>
              <option value="3">3 stars</option>
              <option value="2">2 stars</option>
              <option value="1">1 star</option>
            </select>
            <select
              className="rpx-select"
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
              value={filters.skill}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, skill: event.target.value }))
              }
              aria-label="Filter by skill"
            >
              <option value="all">All skills</option>
              {skillOptions.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
            <select
              className="rpx-select"
              value={filters.session}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, session: event.target.value }))
              }
              aria-label="Filter by session"
            >
              <option value="all">All sessions</option>
              {sessionOptions.map((session) => (
                <option key={session} value={session}>
                  {session}
                </option>
              ))}
            </select>
          </div>
          <div className="rpx-filters__row">
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
            <select
              className="rpx-select"
              value={filters.sort}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, sort: event.target.value }))
              }
              aria-label="Sort by"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
              <option value="mostHelpful">Most helpful</option>
              <option value="leastHelpful">Least helpful</option>
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
                  Reviews are temporarily unavailable
                </p>
                <p className="rpx-error__desc">
                  Try refreshing to fetch the latest mentor feedback.
                </p>
                <button
                  type="button"
                  className="rpx-empty__btn rpx-empty__btn--outline"
                  style={{ marginTop: 4 }}
                  onClick={() => loadReviews()}
                >
                  <Icon name="refresh" /> Retry
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
                    ? "Once learners complete sessions, they can leave feedback about their experience. Create a session to get started."
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
                    onClick={() => openReview(review)}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    {/* Card Header */}
                    <div className="rpx-review-card__head">
                      <div className="rpx-review-card__user">
                        <div className="rpx-review-card__avatar">
                          {(review.learnerName || "L").charAt(0)}
                        </div>
                        <div className="rpx-review-card__info">
                          <div className="rpx-review-card__name">
                            {review.learnerName || "Learner"}
                            {review.learnerVerified && (
                              <span className="rpx-badge-verified">
                                <Icon name="verified" /> Verified
                              </span>
                            )}
                          </div>
                          <div className="rpx-review-card__meta">
                            <span>{formatDate(review.createdAt)}</span>
                            <span aria-hidden="true">•</span>
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
                          </div>
                        </div>
                      </div>
                      <StarRating rating={review.rating || 0} />
                    </div>

                    {/* Card Body */}
                    <div className="rpx-review-card__body">
                      <div className="rpx-review-card__tags">
                        {review.skillName && (
                          <span className="rpx-tag">
                            <Icon name="local_police" />
                            {review.skillName}
                          </span>
                        )}
                        {review.sessionTitle && (
                          <span className="rpx-tag">
                            <Icon name="event_note" />
                            {review.sessionTitle}
                          </span>
                        )}
                      </div>
                      <h3 className="rpx-review-card__title">
                        {review.title || "Learner feedback"}
                      </h3>
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
              <div className="rpx-overall-rating">
                <CircularChart
                  value={Number(summary.averageRating).toFixed(1)}
                  label="out of 5"
                />
              </div>
              <div className="rpx-rating-dist">
                {ratingBreakdown.map((item) => (
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
                    <span className="rpx-rating-row__count">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Most Appreciated Skills */}
            <div className="rpx-sidebar-card">
              <div className="rpx-sidebar-card__head">
                <h2 className="rpx-sidebar-card__title">
                  <Icon name="workspace_premium" /> Top Skills
                </h2>
              </div>
              <div className="rpx-skills-list">
                {TOP_SKILLS.map((skill) => (
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
              <div style={{ marginTop: 12 }}>
                <div className="rpx-skill-pills">
                  {TOP_SKILLS.map((skill) => (
                    <span
                      key={skill.name}
                      className={`rpx-skill-pill rpx-skill-pill--${skill.color}`}
                    >
                      {skill.name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Improvement Suggestions */}
            <div className="rpx-sidebar-card">
              <div className="rpx-sidebar-card__head">
                <h2 className="rpx-sidebar-card__title">
                  <Icon name="lightbulb" /> Improvement Suggestions
                </h2>
              </div>
              <div className="rpx-suggestions">
                {IMPROVEMENTS.map((suggestion, index) => (
                  <div key={index} className="rpx-suggestion-item">
                    <div className="rpx-suggestion-item__icon">
                      <Icon name="lightbulb" />
                    </div>
                    <p className="rpx-suggestion-item__text">{suggestion}</p>
                  </div>
                ))}
              </div>
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
                className="rpx-drawer__close"
                type="button"
                onClick={() => setSelectedReview(null)}
                title="Close"
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
