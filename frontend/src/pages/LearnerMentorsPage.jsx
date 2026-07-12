import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";

/* ==========================================================================
   Inline helpers (mirrored from LearnerPages.jsx for self-containedness)
   ========================================================================== */

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

async function apiPost(path, body, config) {
  const response = await client.post(path, body, config);
  return unwrapResponse(response.data);
}

async function apiDelete(path, config) {
  const response = await client.delete(path, config);
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

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));

    Promise.resolve()
      .then(loader)
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

function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);
  return debounced;
}

function initials(value) {
  return String(value || "?")
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function splitSkills(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => splitSkills(item))
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .flatMap((item) => splitSkills(item?.name ?? item))
          .map((part) => part.trim())
          .filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return text
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

/* ==========================================================================
   Mentor extras helper (mirrored from LearnerPages.jsx)
   ========================================================================== */

const LANGUAGE_FALLBACK = ["English"];

function mentorExtras(rawData) {
  const experience = Number(rawData?.experienceYears || rawData?.yearsOfExperience || 0);
  const company = rawData?.company || rawData?.currentCompany || null;
  const role = rawData?.headline || rawData?.title || null;
  const price = rawData?.minSessionPrice ?? rawData?.hourlyRate ?? null;
  const languages = splitSkills(rawData?.languages);
  const responseMinutes = Number(rawData?.responseTimeMinutes || 0);
  const sessions = Number(rawData?.totalCompletedSessions || 0);
  return {
    experience,
    company,
    role,
    price,
    languages: languages.length ? languages : LANGUAGE_FALLBACK,
    responseLabel: responseMinutes
      ? responseMinutes >= 60
        ? `~${Math.round(responseMinutes / 60)}h`
        : `~${responseMinutes}m`
      : "Within a day",
    sessions,
  };
}

/* ==========================================================================
   Premium Mentor Card
   ========================================================================== */

function PremiumMentorCard({ mentor, saved, onSaveToggle, rawData }) {
  const skills = mentor.skills || [];
  const rating = Number(mentor.averageRating || rawData?.averageRating || 0);
  const reviews = Number(mentor.totalReviews || rawData?.totalReviews || 0);
  const liveNow = mentor.liveNow || rawData?.liveNow || false;
  const extras = mentorExtras(rawData);

  return (
    <article className="lf-mentor-card md-animate">
      <div className="lf-mentor-card__inner">
        {/* Left: avatar + info */}
        <div className="lf-mentor-card__left">
          <div className="lf-mentor-card__avatar-section">
            <div className="lf-mentor-card__avatar-wrap">
              {mentor.profileImageUrl ? (
                <img
                  className="lf-mentor-card__avatar"
                  src={mentor.profileImageUrl}
                  alt={mentor.fullName}
                />
              ) : (
                <div className="lf-mentor-card__avatar lf-mentor-card__avatar--fallback">
                  {initials(mentor.fullName)}
                </div>
              )}
              <span className={`lf-mentor-card__online${liveNow ? " is-live" : ""}`} />
            </div>
          </div>

          <div className="lf-mentor-card__body">
            <div className="lf-mentor-card__name-row">
              <h3 className="lf-mentor-card__name">{mentor.fullName}</h3>
              {mentor.mentorVerified && (
                <span className="lf-mentor-card__verified">
                  <Icon name="verified" />
                </span>
              )}
              {liveNow && <span className="lf-mentor-card__live-badge">Live</span>}
            </div>

            <p className="lf-mentor-card__role">
              {extras.role ? (
                <>
                  {extras.role}
                  {extras.company ? <span className="lf-mentor-card__company"> @ {extras.company}</span> : null}
                </>
              ) : liveNow ? (
                "Active mentor"
              ) : (
                "Mentor"
              )}
            </p>

            {skills.length > 0 && (
              <div className="lf-mentor-card__skills">
                {skills.slice(0, 5).map((s) => (
                  <span key={s} className="lf-mentor-card__skill-chip">{s}</span>
                ))}
                {skills.length > 5 && (
                  <span className="lf-mentor-card__skill-more">+{skills.length - 5}</span>
                )}
              </div>
            )}

            <div className="lf-mentor-card__stats">
              <span className="lf-mentor-card__stat">
                <Icon name="star" />
                <span className="lf-mentor-card__stat-val">{rating > 0 ? rating.toFixed(1) : "—"}</span>
                <span className="lf-mentor-card__stat-lbl">({reviews})</span>
              </span>
              <span className="lf-mentor-card__stat-divider" />
              <span className="lf-mentor-card__stat">
                <Icon name="timelapse" />
                <span className="lf-mentor-card__stat-val">
                  {extras.experience > 0 ? `${extras.experience}y` : `${extras.sessions}`}
                </span>
                <span className="lf-mentor-card__stat-lbl">
                  {extras.experience ? "exp." : "sessions"}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: price + actions */}
        <div className="lf-mentor-card__right">
          <div className="lf-mentor-card__price-card">
            <span className="lf-mentor-card__price-label">Starting from</span>
            <span className="lf-mentor-card__price-value">
              ₹{extras.price != null ? Number(extras.price).toFixed(0) : "Free"}
            </span>
            <span className="lf-mentor-card__price-unit">/session</span>
          </div>
          <Link
            to={`/mentors/${mentor.id}`}
            className="lf-mentor-card__view-btn"
          >
            View Profile
          </Link>
          <button
            type="button"
            className={`lf-mentor-card__save${saved ? " is-saved" : ""}`}
            onClick={() => onSaveToggle(mentor.id)}
            aria-label={saved ? "Remove saved mentor" : "Save mentor"}
          >
            <Icon name={saved ? "favorite" : "favorite_border"} />
          </button>
        </div>
      </div>
    </article>
  );
}

/* ==========================================================================
   Premium Mentor Skeleton Card
   ========================================================================== */

function MentorSkeletonCard() {
  return (
    <div className="lf-skel-card">
      <div className="lf-skel-inner">
        <div className="lf-skel-left">
          <div className="lf-skel-avatar" />
          <div className="lf-skel-body">
            <div className="lf-skel-line lf-skel-line--50" />
            <div className="lf-skel-line lf-skel-line--70" />
            <div className="lf-skel-skills">
              <div className="lf-skel-pill" />
              <div className="lf-skel-pill" />
              <div className="lf-skel-pill" />
            </div>
            <div className="lf-skel-line lf-skel-line--40" />
          </div>
        </div>
        <div className="lf-skel-right">
          <div className="lf-skel-price" />
          <div className="lf-skel-btn" />
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   Premium Empty State
   ========================================================================== */

function MentorsEmptyState({ query }) {
  return (
    <div className="lf-empty-state md-animate">
      <div className="lf-empty-state__icon-wrap">
        <Icon name="search_off" />
      </div>
      <div className="lf-empty-state__content">
        <h3 className="lf-empty-state__title">
          {query ? `No mentors matching "${query}"` : "No mentors found"}
        </h3>
        <p className="lf-empty-state__desc">
          {query
            ? "Try a different keyword, adjust your filters, or browse all available mentors."
            : "No mentors match your current filters. Try widening your search criteria."}
        </p>
        <Link to="/learner/skills" className="lf-btn lf-btn--primary">
          <Icon name="auto_stories" /> Explore Skills
        </Link>
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN PAGE — LearnerMentorsPage (premium redesign)
   ========================================================================== */

export default function LearnerMentorsPage() {
  useDocumentTitle("Find Mentors");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [minExperience, setMinExperience] = useState(0);
  const [availability, setAvailability] = useState("any");
  const [maxPrice, setMaxPrice] = useState(0);
  const [skillFilter, setSkillFilter] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const debouncedQuery = useDebouncedValue(query, 350);

  const { loading, data, error } = useResource(async () => {
    const [mentorResults, savedMentors] = await Promise.all([
      apiGet("/api/v1/search/mentors", {
        params: {
          ...(debouncedQuery ? { q: debouncedQuery } : {}),
          sort,
          ...(minRating > 0 ? { minRating } : {}),
          size: 40,
        },
      }),
      apiGet("/api/v1/watchlist/mentors").catch(() => []),
    ]);
    return { mentors: mentorResults || [], savedMentors: savedMentors || [] };
  }, [debouncedQuery, sort, minRating, refreshKey]);

  const rawMentors = useMemo(() => data?.mentors || [], [data]);
  const savedMentors = useMemo(() => data?.savedMentors || [], [data]);

  const liveMentors = useMemo(
    () =>
      rawMentors.map((m) => ({
        id: m.mentorId,
        fullName: m.mentorName,
        skills: splitSkills(m.skills),
        profileImageUrl: m.profileImageUrl,
        averageRating: Number(m.averageRating || 0),
        totalReviews: Number(m.totalReviews || 0),
        liveNow: Boolean(m.liveNow),
        mentorVerified: Boolean(m.mentorVerified),
      })),
    [rawMentors],
  );

  const savedMentorIds = useMemo(
    () =>
      new Set(
        savedMentors.map((i) => i?.mentor?.id ?? i?.mentorId ?? i?.id).filter(Boolean),
      ),
    [savedMentors],
  );

  const skillOptions = useMemo(() => {
    const set = new Set();
    liveMentors.forEach((m) => m.skills.forEach((s) => set.add(s)));
    return [...set].sort().slice(0, 40);
  }, [liveMentors]);

  /* Category filtering */
  const filtered = useMemo(() => {
    let list = liveMentors;

    if (activeCategory === "online") {
      list = list.filter((m) => m.liveNow);
    } else if (activeCategory === "toprated") {
      list = list.filter((m) => m.averageRating >= 4);
    } else if (activeCategory === "new") {
      list = list.filter((_, idx) => idx < 10);
    }

    return list.filter((mentor, idx) => {
      const extras = mentorExtras(rawMentors[idx]);
      if (minExperience && extras.experience < minExperience) return false;
      if (availability === "online" && !mentor.liveNow) return false;
      if (maxPrice && extras.price != null && Number(extras.price) > maxPrice) return false;
      if (skillFilter && !mentor.skills.some((s) => s.toLowerCase() === skillFilter.toLowerCase()))
        return false;
      return true;
    });
  }, [liveMentors, rawMentors, activeCategory, minExperience, availability, maxPrice, skillFilter]);

  const averageRating = liveMentors.length
    ? liveMentors.reduce((s, m) => s + m.averageRating, 0) / liveMentors.length
    : 0;

  async function toggleMentorSave(mentorId) {
    const isSaved = savedMentorIds.has(mentorId);
    try {
      if (isSaved) await apiDelete(`/api/v1/watchlist/mentors/${mentorId}`);
      else await apiPost(`/api/v1/watchlist/mentors/${mentorId}`);
      setRefreshKey((v) => v + 1);
    } catch (e) {
      window.console.error(e);
    }
  }

  function resetFilters() {
    setMinRating(0);
    setMinExperience(0);
    setAvailability("any");
    setMaxPrice(0);
    setSkillFilter("");
  }

  const topCategories = [
    { name: "Programming", icon: "code" },
    { name: "Web Development", icon: "web" },
    { name: "Data Science", icon: "analytics" },
    { name: "Design", icon: "palette" },
    { name: "Business", icon: "business_center" },
  ];

  const categoryTabs = [
    { key: "all", label: "All Mentors", icon: "group" },
    { key: "online", label: "Online Now", icon: "wifi_tethering" },
    { key: "toprated", label: "Top Rated", icon: "star" },
    { key: "new", label: "New Mentors", icon: "fiber_new" },
  ];

  const onlineNow = liveMentors.filter((m) => m.liveNow).length;

  /* ── Render ── */

  return (
    <div className="lf-shell">
      {/* ═══ HERO SECTION ═══ */}
      <div className="lf-hero md-animate">
        <div className="lf-hero__layout">
          {/* Left: heading, search, filters */}
          <div className="lf-hero__left">
            <div className="lf-hero__badge">MENTOR MARKETPLACE</div>
            <h1 className="lf-hero__title">
              Find Your Perfect <span className="lf-hero__title-highlight">Mentor</span>
            </h1>
            <p className="lf-hero__sub">
              Discover expert mentors across 100+ skills. Book 1-on-1 sessions,
              save favourites, and accelerate your growth.
            </p>
            <div className="lf-hero__actions">
              <label className="lf-hero__search">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, skill, or technology\u2026"
                  aria-label="Search mentors"
                />
                {query && (
                  <button
                    type="button"
                    className="lf-hero__search-clear"
                    onClick={() => setQuery("")}
                    aria-label="Clear search"
                  >
                    <Icon name="close" />
                  </button>
                )}
              </label>
              <button
                type="button"
                className={`lf-btn lf-btn--filter${showFilters ? " is-active" : ""}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <Icon name="tune" /> Filters
              </button>
              <label className="lf-hero__select">
                <Icon name="sort" />
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="recent">Most Recent</option>
                  <option value="rating">Top Rated</option>
                  <option value="reviews">Most Reviews</option>
                  <option value="sessions">Most Sessions</option>
                  <option value="price_asc">Lowest Price</option>
                </select>
              </label>
            </div>
          </div>

          {/* Right: illustration + top categories */}
          <div className="lf-hero__right">
            <div className="lf-hero__illustration">
              <div className="lf-hero__illustration-bg">
                <div className="lf-hero__orb lf-hero__orb--1" />
                <div className="lf-hero__orb lf-hero__orb--2" />
                <div className="lf-hero__orb lf-hero__orb--3" />
              </div>
              <div className="lf-hero__illustration-main">
                <Icon name="person_search" />
              </div>
            </div>
            <div className="lf-hero__categories-card">
              <div className="lf-hero__categories-header">
                <Icon name="category" />
                <span>Top Categories</span>
              </div>
              <div className="lf-hero__categories-list">
                {topCategories.slice(0, 4).map((cat) => (
                  <button
                    key={cat.name}
                    type="button"
                    className="lf-hero__category-chip"
                    onClick={() => {
                      setQuery(cat.name);
                    }}
                  >
                    <Icon name={cat.icon} />
                    {cat.name}
                  </button>
                ))}
              </div>
              <Link to="/learner/skills" className="lf-hero__categories-all">
                View All Categories
                <Icon name="arrow_forward" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ STATS CARDS ═══ */}
      <div className="lf-stats md-animate">
        <div className="lf-stat-card">
          <div className="lf-stat-card__icon" style={{ background: "linear-gradient(135deg, #0f766e15, #14b8a615)", color: "#0f766e" }}>
            <Icon name="group" />
          </div>
          <div className="lf-stat-card__body">
            <span className="lf-stat-card__value">{liveMentors.length}</span>
            <span className="lf-stat-card__label">Total Mentors</span>
            <span className="lf-stat-card__desc">Matching your search</span>
          </div>
          <div className="lf-stat-card__trend" />
        </div>
        <div className="lf-stat-card">
          <div className="lf-stat-card__icon" style={{ background: "linear-gradient(135deg, #10b98115, #34d39915)", color: "#059669" }}>
            <Icon name="wifi_tethering" />
          </div>
          <div className="lf-stat-card__body">
            <span className="lf-stat-card__value">{onlineNow}</span>
            <span className="lf-stat-card__label">Online Now</span>
            <span className="lf-stat-card__desc">Active mentors</span>
          </div>
          <div className="lf-stat-card__trend" />
        </div>
        <div className="lf-stat-card">
          <div className="lf-stat-card__icon" style={{ background: "linear-gradient(135deg, #6366f115, #818cf815)", color: "#4f46e5" }}>
            <Icon name="bookmark" />
          </div>
          <div className="lf-stat-card__body">
            <span className="lf-stat-card__value">{savedMentors.length}</span>
            <span className="lf-stat-card__label">Saved Mentors</span>
            <span className="lf-stat-card__desc">Your shortlist</span>
          </div>
          <div className="lf-stat-card__trend" />
        </div>
        <div className="lf-stat-card">
          <div className="lf-stat-card__icon" style={{ background: "linear-gradient(135deg, #f59e0b15, #fbbf2415)", color: "#d97706" }}>
            <Icon name="star" />
          </div>
          <div className="lf-stat-card__body">
            <span className="lf-stat-card__value">{averageRating > 0 ? averageRating.toFixed(1) : "—"}</span>
            <span className="lf-stat-card__label">Avg Rating</span>
            <span className="lf-stat-card__desc">Across all mentors</span>
          </div>
          <div className="lf-stat-card__trend" />
        </div>
      </div>

      {/* ═══ CATEGORY TABS + ADVANCED FILTERS ═══ */}
      <div className="lf-category-bar md-animate">
        <div className="lf-category-tabs">
          {categoryTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`lf-category-tab${activeCategory === tab.key ? " is-active" : ""}`}
              onClick={() => setActiveCategory(tab.key)}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`lf-btn lf-btn--filter${showFilters ? " is-active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Icon name="tune" /> Advanced Filters
        </button>
      </div>

      {/* ═══ ADVANCED FILTERS PANEL ═══ */}
      {showFilters && (
        <div className="lf-filter-panel md-animate">
          <div className="lf-filter-group">
            <label>Skill</label>
            <select value={skillFilter} onChange={(e) => setSkillFilter(e.target.value)}>
              <option value="">Any skill</option>
              {skillOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="lf-filter-group">
            <label>Experience</label>
            <select value={minExperience} onChange={(e) => setMinExperience(Number(e.target.value))}>
              <option value={0}>Any experience</option>
              <option value={1}>1+ years</option>
              <option value={3}>3+ years</option>
              <option value={5}>5+ years</option>
            </select>
          </div>
          <div className="lf-filter-group">
            <label>Availability</label>
            <select value={availability} onChange={(e) => setAvailability(e.target.value)}>
              <option value="any">Any time</option>
              <option value="online">Online now</option>
            </select>
          </div>
          <div className="lf-filter-group">
            <label>Max price</label>
            <select value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}>
              <option value={0}>Any price</option>
              <option value={25}>Under $25/hr</option>
              <option value={50}>Under $50/hr</option>
              <option value={100}>Under $100/hr</option>
            </select>
          </div>
          <div className="lf-filter-group">
            <label>Min rating</label>
            <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>Any rating</option>
              <option value={3}>3★ and above</option>
              <option value={4}>4★ and above</option>
              <option value={4.5}>4.5★ and above</option>
            </select>
          </div>
          <div className="lf-filter-actions">
            <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm" onClick={resetFilters}>
              <Icon name="restart_alt" /> Reset
            </button>
            <button type="button" className="lf-btn lf-btn--primary lf-btn--sm" onClick={() => setShowFilters(false)}>
              <Icon name="check" /> Apply
            </button>
          </div>
        </div>
      )}

      {/* ═══ RESULTS HEADER ═══ */}
      <div className="lf-results-header md-animate">
        <h2 className="lf-results-title">
          {debouncedQuery ? `Results for "${debouncedQuery}"` : "All Mentors"}
        </h2>
        {!loading && (
          <span className="lf-results-count">
            {filtered.length} mentor{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* ═══ MENTOR GRID ═══ */}
      {loading ? (
        <div className="lf-grid md-animate">
          {[1, 2, 3, 4, 5, 6].map((k) => (
            <MentorSkeletonCard key={k} />
          ))}
        </div>
      ) : error ? (
        <div className="lf-error md-animate">
          <div className="lf-error__icon">
            <Icon name="error" />
          </div>
          <p className="lf-error__title">Mentors could not be loaded</p>
          <p className="lf-error__desc">{error}</p>
          <button
            type="button"
            className="lf-btn lf-btn--primary lf-btn--sm"
            onClick={() => setRefreshKey((v) => v + 1)}
          >
            <Icon name="refresh" /> Retry
          </button>
        </div>
      ) : filtered.length > 0 ? (
        <div className="lf-grid md-animate">
          {filtered.map((mentor) => {
            const idx = liveMentors.indexOf(mentor);
            return (
              <PremiumMentorCard
                key={mentor.id}
                mentor={mentor}
                rawData={rawMentors[idx]}
                saved={savedMentorIds.has(mentor.id)}
                onSaveToggle={toggleMentorSave}
              />
            );
          })}
        </div>
      ) : (
        <MentorsEmptyState query={debouncedQuery} />
      )}
    </div>
  );
}
