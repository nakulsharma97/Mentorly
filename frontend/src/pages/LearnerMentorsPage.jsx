import { useMemo, useRef, useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

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
  const bookingAvailable = rawData?.bookingEnabled !== false && rawData?.acceptingStudents !== false;
  const navigate = useNavigate();

  const handleMessage = async (e, mentorId) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const res = await client.post(`/api/v1/chat/direct/${mentorId}`);
      const data = res?.data?.data;
      if (data?.conversationId) {
        navigate(`/learner/messages/${data.conversationId}`);
      } else {
        navigate("/learner/messages");
      }
    } catch (err) {
      window.console.error("[Message] Navigation failed:", err);
      navigate("/learner/messages");
    }
  };

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

          {extras.languages.length > 0 && (
            <div className="lf-mentor-card__languages">
              <Icon name="translate" />
              {extras.languages.slice(0, 3).join(", ")}
            </div>
          )}

          <div className="lf-mentor-card__response">
            <Icon name="bolt" />
            <span>{extras.responseLabel}</span>
            <span className="lf-mentor-card__response-lbl">response</span>
          </div>

          <div className="lf-mentor-card__actions">
            {bookingAvailable ? (
              <Link
                to={`/mentors/${mentor.id}`}
                className="lf-mentor-card__action-btn lf-mentor-card__action-btn--primary"
                title="Book a session"
              >
                <Icon name="calendar_month" /> Book
              </Link>
            ) : (
              <span
                className="lf-mentor-card__action-btn--disabled"
                data-disabled-tip="Mentor has not enabled session booking yet."
                title="Mentor has not enabled session booking yet."
              >
                <Icon name="calendar_month" /> Book
              </span>
            )}
            <button
              type="button"
              className="lf-mentor-card__action-btn lf-mentor-card__action-btn--secondary"
              title="Send a message"
              onClick={(e) => handleMessage(e, mentor.id)}
            >
              <Icon name="chat" /> Message
            </button>
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
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onSaveToggle(mentor.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.stopPropagation();
                e.preventDefault();
                onSaveToggle(mentor.id);
              }
            }}
            aria-label={saved ? "Remove mentor from wishlist" : "Add mentor to wishlist"}
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

function MentorsEmptyState({ query, apiReturnedEmpty }) {
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
            : apiReturnedEmpty
              ? "No mentors are available right now. Check back soon for new mentors joining the marketplace."
              : "No mentors match your current filters. Try widening your search criteria."}
        </p>
        {apiReturnedEmpty ? (
          <Link to="/learner/skills" className="lf-btn lf-btn--primary">
            <Icon name="auto_stories" /> Explore Skills
          </Link>
        ) : (
          <button type="button" className="lf-btn lf-btn--outline" onClick={() => window.location.reload()}>
            <Icon name="refresh" /> Refresh
          </button>
        )}
      </div>
    </div>
  );
}

/* ==========================================================================
   MAIN PAGE — LearnerMentorsPage (premium redesign)
   ========================================================================== */

export default function LearnerMentorsPage() {
  useDocumentTitle("Find Mentors");
  const [searchParams] = useSearchParams();
  const skillParam = searchParams.get("skill") || "";
  const [query, setQuery] = useState(skillParam);
  const [sort, setSort] = useState("recent");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [minExperience, setMinExperience] = useState(0);
  const [availability, setAvailability] = useState("any");
  const [maxPrice, setMaxPrice] = useState(0);
  const [skillFilter, setSkillFilter] = useState("");
  const [languageFilter, setLanguageFilter] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const searchInputRef = useRef(null);

  // Focus search on "/" keypress
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

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

  const languageOptions = useMemo(() => {
    const set = new Set();
    rawMentors.forEach((m) => {
      mentorExtras(m).languages.forEach((lang) => set.add(lang));
    });
    return [...set].sort();
  }, [rawMentors]);

  /* ── Build a mentorId → rawData lookup map for O(1) access ── */
  const rawMentorMap = useMemo(() => {
    const map = new Map();
    rawMentors.forEach((r) => {
      if (r && r.mentorId != null) map.set(r.mentorId, r);
    });
    return map;
  }, [rawMentors]);

  /* Category + advanced filtering */
  const filtered = useMemo(() => {
    let list = liveMentors;

    if (activeCategory === "online") {
      list = list.filter((m) => m.liveNow);
    } else if (activeCategory === "toprated") {
      list = list.filter((m) => m.averageRating >= 4);
    } else if (activeCategory === "new") {
      list = list.filter((_, idx) => idx < 10);
    }

    return list.filter((mentor) => {
      const raw = rawMentorMap.get(mentor.id) || {};
      const extras = mentorExtras(raw);
      if (minExperience && extras.experience < minExperience) return false;
      if ((availability === "online" || onlineOnly) && !mentor.liveNow) return false;
      if (maxPrice && extras.price != null && Number(extras.price) > maxPrice) return false;
      if (skillFilter && !mentor.skills.some((s) => s.toLowerCase() === skillFilter.toLowerCase()))
        return false;
      if (languageFilter && !extras.languages.some((l) => l.toLowerCase() === languageFilter.toLowerCase()))
        return false;
      return true;
    });
  }, [liveMentors, rawMentorMap, activeCategory, minExperience, availability, maxPrice, skillFilter, languageFilter, onlineOnly]);

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
    setLanguageFilter("");
    setOnlineOnly(false);
  }

  const categoryTabs = [
    { key: "all", label: "All Mentors", icon: "group" },
    { key: "online", label: "Online Now", icon: "wifi_tethering" },
    { key: "toprated", label: "Top Rated", icon: "star" },
    { key: "new", label: "New Mentors", icon: "fiber_new" },
  ];

  const onlineNow = liveMentors.filter((m) => m.liveNow).length;

  /* ── Render ── */

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ═══ PREMIUM HERO ═══ */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>person_search</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>person_search</span>
            MENTORS
          </div>
          <h1>Find Your Perfect Mentor</h1>
          <p className="mp-hero__sub">
            Discover expert mentors across 100+ skills. Book 1-on-1 sessions, save favourites, and accelerate your growth.
          </p>
          <div className="mp-hero__actions" style={{ flexWrap: "wrap", gap: 8 }}>
            <label className="lf-hero__search" style={{ flex: 1, minWidth: 220, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
              <Icon name="search" style={{ color: "rgba(255,255,255,0.60)" }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, skill, or technology\u2026"
                aria-label="Search mentors"
                style={{ color: "#fff" }}
              />
              {query && (
                <button
                  type="button"
                  className="lf-hero__search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  style={{ color: "rgba(255,255,255,0.60)" }}
                >
                  <Icon name="close" />
                </button>
              )}
            </label>
            <button
              type="button"
              className={`lf-btn lf-btn--filter${showFilters ? " is-active" : ""}`}
              onClick={() => setShowFilters((v) => !v)}
              style={{
                background: showFilters ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.08)",
                color: "#fff", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "var(--mp-radius)",
                padding: "9px 14px", display: "inline-flex", alignItems: "center", gap: 6,
                fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", fontFamily: "var(--mp-font)"
              }}
            >
              <Icon name="tune" /> Filters
            </button>
            <label className="lf-hero__select" style={{
              background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
              color: "#fff", borderRadius: "var(--mp-radius)", padding: "8px 12px",
              display: "inline-flex", alignItems: "center", gap: 6
            }}>
              <Icon name="sort" style={{ color: "rgba(255,255,255,0.60)", fontSize: 18 }} />
              <select value={sort} onChange={(e) => setSort(e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: "0.82rem", outline: "none" }}>
                <option value="recent" style={{ color: "#111" }}>Most Recent</option>
                <option value="rating" style={{ color: "#111" }}>Top Rated</option>
                <option value="reviews" style={{ color: "#111" }}>Most Reviews</option>
                <option value="sessions" style={{ color: "#111" }}>Most Sessions</option>
                <option value="price_asc" style={{ color: "#111" }}>Lowest Price</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* ═══ STATS CARDS ═══ */}
      <div className="mp-stats" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginTop: 16 }}>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>group</span></div>
          </div>
          <p className="mp-stat__value">{liveMentors.length}</p>
          <p className="mp-stat__label">Total Mentors</p>
          <p className="mp-stat__desc">Matching your search</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>wifi_tethering</span></div>
          </div>
          <p className="mp-stat__value">{onlineNow}</p>
          <p className="mp-stat__label">Online Now</p>
          <p className="mp-stat__desc">Active mentors</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>bookmark</span></div>
          </div>
          <p className="mp-stat__value">{savedMentors.length}</p>
          <p className="mp-stat__label">Saved Mentors</p>
          <p className="mp-stat__desc">Your shortlist</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>star</span></div>
          </div>
          <p className="mp-stat__value">{averageRating > 0 ? averageRating.toFixed(1) : "—"}</p>
          <p className="mp-stat__label">Avg Rating</p>
          <p className="mp-stat__desc">Across all mentors</p>
        </div>
      </div>

      {/* ═══ FEATURED MENTORS ═══ */}
      {!loading && liveMentors.length > 0 && (
        <section className="lf-featured md-animate">
          <div className="lf-featured__head">
            <h2 className="lf-featured__title">
              <Icon name="workspace_premium" /> Featured Mentors
            </h2>
            <p className="lf-featured__sub">Top-rated mentors ready to help you grow</p>
          </div>
          <div className="lf-featured__grid">
            {liveMentors
              .filter((m) => m.averageRating >= 4.5)
              .slice(0, 3)
              .map((mentor) => {
                const raw = rawMentors.find((r) => r.mentorId === mentor.id) || {};
                const extras = mentorExtras(raw);
                return (
                  <div key={mentor.id} className="lf-featured-card">
                    <div className="lf-featured-card__badge">
                      <Icon name="stars" /> Featured
                    </div>
                    <div className="lf-featured-card__avatar">
                      {mentor.profileImageUrl ? (
                        <img src={mentor.profileImageUrl} alt={mentor.fullName} />
                      ) : (
                        <span>{initials(mentor.fullName)}</span>
                      )}
                      <span className={`lf-featured-card__live${mentor.liveNow ? " is-live" : ""}`} />
                    </div>
                    <h3 className="lf-featured-card__name">{mentor.fullName}</h3>
                    <p className="lf-featured-card__role">{extras.role || "Expert Mentor"}</p>
                    <div className="lf-featured-card__rating">
                      <Icon name="star" />
                      <span>{mentor.averageRating.toFixed(1)}</span>
                      <span className="lf-featured-card__reviews">({mentor.totalReviews || 0} reviews)</span>
                    </div>
                    <div className="lf-featured-card__actions">
                      <Link to={`/mentors/${mentor.id}`} className="lf-btn lf-btn--primary lf-btn--sm">
                        View Profile
                      </Link>
                      <button
                        type="button"
                        className={`lf-featured-card__save${savedMentorIds.has(mentor.id) ? " is-saved" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          toggleMentorSave(mentor.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.stopPropagation();
                            e.preventDefault();
                            toggleMentorSave(mentor.id);
                          }
                        }}
                        aria-label={savedMentorIds.has(mentor.id) ? "Remove mentor from wishlist" : "Add mentor to wishlist"}
                      >
                        <Icon name={savedMentorIds.has(mentor.id) ? "favorite" : "favorite_border"} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ═══ SEARCH BAR (above tabs, always visible) ═══ */}
      <div className="mp-search-bar md-animate">
        <div className="mp-search-bar__inner">
          <span className="material-symbols-outlined mp-search-bar__icon">search</span>
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search mentors by name, skill, or technology..."
            aria-label="Search mentors"
            className="mp-search-bar__input"
          />
          {query && (
            <button
              type="button"
              className="mp-search-bar__clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
          <kbd className="mp-search-bar__kbd">/</kbd>
        </div>
        <div className="mp-search-bar__hint">
          Press <kbd>/</kbd> to focus
        </div>
      </div>

      {/* ═══ CATEGORY TABS + QUICK TOGGLES + ADVANCED FILTERS ═══ */}
      <div className="lf-category-bar md-animate">
        <div className="lf-category-tabs">
          {categoryTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`lf-category-tab${activeCategory === tab.key ? " is-active" : ""}`}
              onClick={() => { setActiveCategory(tab.key); if (tab.key !== "online") setOnlineOnly(false); }}
            >
              <Icon name={tab.icon} />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="lf-category-bar__right">
          <button
            type="button"
            className={`lf-online-toggle${onlineOnly ? " is-active" : ""}`}
            onClick={() => setOnlineOnly((v) => !v)}
            title={onlineOnly ? "Show all mentors" : "Show only online mentors"}
          >
            <span className={`lf-online-toggle__dot${onlineOnly ? " is-live" : ""}`} />
            <span>Online Only</span>
            {onlineOnly && <Icon name="close" />}
          </button>
          <button
            type="button"
            className={`lf-btn lf-btn--filter${showFilters ? " is-active" : ""}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Icon name="tune" /> Advanced Filters
          </button>
        </div>
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
            <label>Language</label>
            <select value={languageFilter} onChange={(e) => setLanguageFilter(e.target.value)}>
              <option value="">Any language</option>
              {languageOptions.map((lang) => (
                <option key={lang} value={lang}>{lang}</option>
              ))}
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
        <div className="md-empty" style={{ margin: "24px 0" }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">error_outline</span>
          </div>
          <h3 className="md-empty__title">Mentors could not be loaded</h3>
          <p className="md-empty__desc">{error}</p>
          <button
            type="button"
            className="mp-btn mp-btn--primary"
            onClick={() => setRefreshKey((v) => v + 1)}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span>
            Retry
          </button>
        </div>
      ) : filtered.length > 0 ? (
        <div className="lf-grid md-animate">
          {filtered.map((mentor) => (
            <PremiumMentorCard
              key={mentor.id}
              mentor={mentor}
              rawData={rawMentorMap.get(mentor.id) || null}
              saved={savedMentorIds.has(mentor.id)}
              onSaveToggle={toggleMentorSave}
            />
          ))}
        </div>
      ) : (
        <MentorsEmptyState query={debouncedQuery} apiReturnedEmpty={rawMentors.length === 0} />
      )}
    </div>
  );
}
