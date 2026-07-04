import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import StatsCard from "../modules/common/dashboard/StatsCard";
import { EmptyState } from "../modules/common/dashboard/SectionCard";
import "../modules/mentor/mentor-pages.css";
import * as XLSX from "xlsx";
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

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest rating" },
  { value: "lowest", label: "Lowest rating" },
  { value: "mostHelpful", label: "Most helpful" },
  { value: "leastHelpful", label: "Least helpful" },
];

const EXPORT_OPTIONS = [
  { value: "csv", label: "Export as CSV" },
  { value: "xlsx", label: "Export as Excel" },
  { value: "pdf", label: "Export as PDF" },
];

const REVIEW_COLUMNS = [
  { key: "learnerName", label: "Student Name" },
  { key: "sessionTitle", label: "Session Name" },
  { key: "rating", label: "Rating" },
  { key: "comment", label: "Review" },
  { key: "recommendationLabel", label: "Recommendation" },
  { key: "skillName", label: "Skill" },
  { key: "createdAt", label: "Date" },
  { key: "replyText", label: "Mentor Reply" },
];

function formatDate(value) {
  if (!value) return "—";
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

export default function MentorReviewsPage({ profile, notify }) {
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
  const [reviewSize, setReviewSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedReview, setSelectedReview] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replying, setReplying] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [customRange, setCustomRange] = useState({ from: "", to: "" });
  const filterButtonRef = useRef(null);
  const exportButtonRef = useRef(null);

  useEffect(() => {
    document.title = "Reviews & Ratings | SkillSwap Mentor";
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      if (reviewPage !== 0) {
        setReviewPage(0);
      } else {
        loadReviews();
      }
    }, 300);

    setSearchTimeout(timeout);
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

  useEffect(() => {
    loadReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewPage, reviewSize]);

  const buildReviewQueryParams = () => {
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
  };

  const loadReviews = async ({ showToast = false } = {}) => {
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
  };

  const refreshReviews = async () => {
    setRefreshing(true);
    await loadReviews({ showToast: true });
  };

  const isReviewRecommended = (review) => {
    if (review?.recommended !== undefined) return Boolean(review.recommended);
    const recommendation = String(review?.recommendation || "").toLowerCase();
    return ["recommended", "yes", "true", "y"].includes(recommendation);
  };

  const reviewRecommendationLabel = (review) =>
    isReviewRecommended(review) ? "Recommended" : "Not recommended";

  const reviewDatesMatchRange = (reviewDate, rangeKey) => {
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
  };

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
  }, [filters, reviews, customRange]);

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

  const recommendationRateText = `${summary.recommendationRate.toFixed(0)}%`;

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

  const openReview = (review) => {
    setSelectedReview(review);
    setReplyDraft(review.replyText || "");
  };

  const submitReply = async (event) => {
    event.preventDefault();
    if (!selectedReview?.id) return;
    setReplying(true);
    try {
      await client.post(`/api/v1/reviews/${selectedReview.id}/reply`, {
        replyText: replyDraft.trim(),
      });
      notify?.({
        type: "success",
        title: "Reply saved",
        message: "Your response is now visible to the learner.",
      });
      await loadReviews();
      setSelectedReview((prev) =>
        prev ? { ...prev, replyText: replyDraft.trim() } : prev,
      );
    } catch (err) {
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

  const exportXlsx = (items) => {
    const rows = buildExportRows(items);
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reviews");
    XLSX.writeFile(
      workbook,
      `mentor-reviews-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
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

  const handleReport = async (review) => {
    try {
      await client.post(`/api/v1/reviews/${review.id}/report`, {
        reason: "inappropriate",
      });
      notify?.({
        type: "success",
        title: "Review reported",
        message: "Thank you. Our team will review this feedback.",
      });
    } catch (err) {
      notify?.({
        type: "error",
        title: "Report failed",
        message: err?.response?.data?.message || "Please try again.",
      });
    }
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
      if (type === "xlsx") exportXlsx(exportReviews);
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

  const clearFilters = () => {
    setFilters(INITIAL_FILTERS);
    setCustomRange({ from: "", to: "" });
    setReviewPage(0);
  };

  const stats = [
    {
      title: "Average Rating",
      value: summary.averageRating.toFixed(1),
      subtitle: "Based on all reviews",
      icon: "star_rate",
      accent: "linear-gradient(135deg, #7c3aed, #2563eb)",
    },
    {
      title: "Total Reviews",
      value: summary.totalReviews,
      subtitle: `${Math.max(0, summary.totalReviews - 2)}+ this month`,
      icon: "forum",
      accent: "linear-gradient(135deg, #0f766e, #14b8a6)",
    },
    {
      title: "Recommendation Rate",
      value: `${summary.recommendationRate}%`,
      subtitle: "Learners recommend you",
      icon: "thumb_up",
      accent: "linear-gradient(135deg, #d97706, #f59e0b)",
    },
    {
      title: "Five Star Reviews",
      value: summary.fiveStarReviews,
      subtitle: `${summary.totalReviews ? Math.round((summary.fiveStarReviews / summary.totalReviews) * 100) : 0}% of all reviews`,
      icon: "workspace_premium",
      accent: "linear-gradient(135deg, #db2777, #ec4899)",
    },
  ];

  return (
    <main className="md">
      <div className="md-shell md-animate">
        <header className="mp-head">
          <div>
            <h1 className="mp-head__title">Reviews &amp; Ratings</h1>
            <p className="mp-head__sub">
              Track your teaching reputation, monitor learner satisfaction, and
              improve your mentoring quality.
            </p>
          </div>
          <div className="mp-head__actions">
            <button
              className="md-btn md-btn--outline md-btn--sm"
              type="button"
              onClick={refreshReviews}
              disabled={refreshing}
            >
              <Icon name="refresh" /> {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            <button
              className="md-btn md-btn--outline md-btn--sm"
              type="button"
              onClick={() =>
                document
                  .querySelector(".mp-toolbar")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              <Icon name="filter_alt" /> Filter
            </button>
            <div className="mp-export-group">
              <button
                className="md-btn md-btn--brand md-btn--sm"
                type="button"
                onClick={() => setExportMenuOpen((open) => !open)}
              >
                <Icon name="download" /> Export Reviews
              </button>
              {exportMenuOpen && (
                <div className="mp-dropdown-menu">
                  {EXPORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      className="mp-dropdown-item"
                      type="button"
                      onClick={() => handleExport(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <section
          className="md-stats md-animate"
          style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}
        >
          {stats.map((stat) => (
            <StatsCard
              key={stat.title}
              label={stat.title}
              value={stat.value}
              description={stat.subtitle}
              icon={stat.icon}
            />
          ))}
        </section>

        <section className="mp-toolbar md-animate">
          <label className="mp-search">
            <Icon name="search" />
            <input
              value={filters.search}
              placeholder="Search reviews"
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, search: event.target.value }))
              }
            />
          </label>
          <select
            className="mp-select"
            value={filters.rating}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, rating: event.target.value }))
            }
          >
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
          <select
            className="mp-select"
            value={filters.recommendation}
            onChange={(event) =>
              setFilters((prev) => ({
                ...prev,
                recommendation: event.target.value,
              }))
            }
          >
            <option value="all">All recommendations</option>
            <option value="recommended">Recommended</option>
            <option value="notRecommended">Not recommended</option>
          </select>
          <select
            className="mp-select"
            value={filters.skill}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, skill: event.target.value }))
            }
          >
            <option value="all">All skills</option>
            {skillOptions.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>
          <select
            className="mp-select"
            value={filters.session}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, session: event.target.value }))
            }
          >
            <option value="all">All sessions</option>
            {sessionOptions.map((session) => (
              <option key={session} value={session}>
                {session}
              </option>
            ))}
          </select>
          <select
            className="mp-select"
            value={filters.dateRange}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, dateRange: event.target.value }))
            }
          >
            {DATE_RANGE_OPTIONS.map((range) => (
              <option key={range.value} value={range.value}>
                {range.label}
              </option>
            ))}
          </select>
          <select
            className="mp-select"
            value={filters.sort}
            onChange={(event) =>
              setFilters((prev) => ({ ...prev, sort: event.target.value }))
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="highest">Highest rating</option>
            <option value="lowest">Lowest rating</option>
          </select>
          <label className="mp-toggle">
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
            <span>Only verified</span>
          </label>
          <label className="mp-toggle">
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
        </section>

        <div className="mp-reviews-layout">
          <section className="mp-feed">
            {loading ? (
              <div className="mp-skeleton-list">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="mp-review-card mp-review-card--loading"
                  />
                ))}
              </div>
            ) : error ? (
              <EmptyState
                title="Reviews are temporarily unavailable"
                message="Try refreshing to fetch the latest mentor feedback."
                actionLabel="Retry"
                onAction={loadReviews}
              />
            ) : sortedReviews.length === 0 ? (
              <EmptyState
                title="No reviews found"
                message="Adjust your filters or wait for new learner feedback to appear."
              />
            ) : (
              <>
                {sortedReviews.map((review) => (
                  <article
                    key={review.id}
                    className="mp-review-card"
                    onClick={() => openReview(review)}
                  >
                    <div className="mp-review-card__head">
                      <div className="mp-review-card__user">
                        <div className="mp-review-card__avatar">
                          {(review.learnerName || "L").charAt(0)}
                        </div>
                        <div>
                          <p className="mp-review-card__name">
                            {review.learnerName || "Learner"}
                          </p>
                          <p className="mp-review-card__meta">
                            {review.learnerVerified
                              ? "Verified learner"
                              : "Learner"}{" "}
                            • {formatDate(review.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="mp-review-card__rating">
                        {"★".repeat(review.rating || 0)}
                      </div>
                    </div>
                    <div className="mp-review-card__body">
                      <div className="mp-review-card__pill-row">
                        <span className="mp-pill mp-pill--completed">
                          {review.skillName || "General"}
                        </span>
                        <span className="mp-pill mp-pill--active">
                          {review.sessionTitle || "Session"}
                        </span>
                      </div>
                      <h3 className="mp-review-card__title">
                        {review.title || "Learner feedback"}
                      </h3>
                      <p className="mp-review-card__text">
                        {review.comment || "No written feedback provided."}
                      </p>
                      <div className="mp-review-card__footer">
                        <span className="mp-review-card__helpful">
                          Helpful • {review.helpfulCount || 0}
                        </span>
                        <div className="mp-review-card__actions">
                          <button
                            className="mp-icon-btn"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReview(review);
                            }}
                          >
                            <Icon name="reply" />
                          </button>
                          <button
                            className="mp-icon-btn"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/mentor/students`);
                            }}
                          >
                            <Icon name="person" />
                          </button>
                          <button
                            className="mp-icon-btn"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              navigate(`/mentor/teach`);
                            }}
                          >
                            <Icon name="event_note" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
                <div className="mp-pagination">
                  <button
                    className="md-btn md-btn--outline md-btn--sm"
                    type="button"
                    disabled={reviewPage <= 0}
                    onClick={() =>
                      setReviewPage((page) => Math.max(0, page - 1))
                    }
                  >
                    Previous
                  </button>
                  <span>
                    Page {Math.min(reviewPage + 1, totalPages || 1)} of{" "}
                    {Math.max(totalPages, 1)}
                  </span>
                  <button
                    className="md-btn md-btn--outline md-btn--sm"
                    type="button"
                    disabled={reviewPage >= totalPages - 1}
                    onClick={() =>
                      setReviewPage((page) =>
                        Math.min(totalPages - 1, page + 1),
                      )
                    }
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </section>

          <aside className="mp-insights">
            <div className="mp-insight-card">
              <div className="mp-insight-card__head">
                <h2>Overall Rating</h2>
                <div className="mp-score-ring">
                  <span>{summary.averageRating.toFixed(1)}</span>
                </div>
              </div>
              <div className="mp-rating-bars">
                {ratingBreakdown.map((item) => (
                  <div key={item.star} className="mp-rating-row">
                    <span>{"★".repeat(item.star)}</span>
                    <div className="mp-rating-track">
                      <div
                        className="mp-rating-fill"
                        style={{ width: `${item.width}%` }}
                      />
                    </div>
                    <strong>{item.count}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="mp-insight-card">
              <h3>Most Appreciated Skills</h3>
              <div className="mp-chip-list">
                {[
                  "Communication",
                  "Knowledge",
                  "Problem Solving",
                  "Interview Guidance",
                  "Projects",
                  "Teaching Style",
                  "Patience",
                ].map((skill) => (
                  <span key={skill} className="mp-chip-pill">
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className="mp-insight-card">
              <h3>Improvement Suggestions</h3>
              <ul className="mp-tip-list">
                <li>Provide more assignments</li>
                <li>Increase session duration</li>
                <li>Share notes after sessions</li>
                <li>Improve microphone quality</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {selectedReview && (
        <div className="mp-overlay" onClick={() => setSelectedReview(null)}>
          <div
            className="mp-drawer"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mp-drawer__head">
              <div className="mp-drawer__head-main">
                <h3 className="mp-drawer__title">Review details</h3>
                <p className="mp-drawer__sub">
                  {selectedReview.learnerName || "Learner"}
                </p>
              </div>
              <button
                className="mp-icon-btn"
                type="button"
                onClick={() => setSelectedReview(null)}
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="mp-drawer__body">
              <div className="mp-kv">
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Skill</p>
                  <p className="mp-kv__v">
                    {selectedReview.skillName || "General"}
                  </p>
                </div>
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Session</p>
                  <p className="mp-kv__v">
                    {selectedReview.sessionTitle || "Session"}
                  </p>
                </div>
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Date</p>
                  <p className="mp-kv__v">
                    {formatDate(selectedReview.createdAt)}
                  </p>
                </div>
                <div className="mp-kv__item">
                  <p className="mp-kv__k">Rating</p>
                  <p className="mp-kv__v">{selectedReview.rating}/5</p>
                </div>
              </div>
              <div className="mp-block">
                <p className="mp-block__label">Learner feedback</p>
                <p className="mp-block__text">
                  {selectedReview.comment || "No written feedback provided."}
                </p>
              </div>
              <div className="mp-block">
                <p className="mp-block__label">Mentor reply</p>
                <p className="mp-block__text">
                  {selectedReview.replyText || "No reply yet."}
                </p>
              </div>
              <form className="mp-reply-form" onSubmit={submitReply}>
                <textarea
                  className="mp-textarea"
                  value={replyDraft}
                  onChange={(event) => setReplyDraft(event.target.value)}
                  placeholder="Write a thoughtful reply to this learner"
                />
                <button
                  className="md-btn md-btn--brand"
                  type="submit"
                  disabled={replying}
                >
                  {replying ? "Saving..." : "Reply to review"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
