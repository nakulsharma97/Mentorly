import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { normalizeSkills } from "../utils/skills";
import Icon from "../modules/common/dashboard/Icon";
import { useFavorites } from "../hooks/useFavorites";
import "./LearnerPages.css";

function useDocumentTitle(title) {
  useEffect(() => {
    document.title = `${title} | SkillSwap`;
  }, [title]);
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


function favoriteMentorId(item) {
  return item?.mentorId ?? item?.mentor?.id ?? item?.id ?? null;
}

function FavoriteMentorCard({ favorite, pending, onRemove }) {
  const id = favoriteMentorId(favorite);
  const skills = normalizeSkills(favorite.skills);
  const languages = normalizeSkills(favorite.languages);
  const rating = Number(favorite.averageRating || 0);
  const reviews = Number(favorite.totalReviews || 0);
  const price = favorite.minSessionPrice ?? favorite.hourlyRate ?? null;
  const liveNow = Boolean(favorite.liveNow);

  return (
    <article className="lf-mentor-card md-animate">
      <div className="lf-mentor-card__inner">
        <div className="lf-mentor-card__left">
          <div className="lf-mentor-card__avatar-section">
            <div className="lf-mentor-card__avatar-wrap">
              {favorite.profileImageUrl ? (
                <img
                  className="lf-mentor-card__avatar"
                  src={favorite.profileImageUrl}
                  alt={favorite.mentorName}
                />
              ) : (
                <div className="lf-mentor-card__avatar lf-mentor-card__avatar--fallback">
                  {initials(favorite.mentorName)}
                </div>
              )}
              <span className={`lf-mentor-card__online${liveNow ? " is-live" : ""}`} />
            </div>
          </div>

          <div className="lf-mentor-card__body">
            <div className="lf-mentor-card__name-row">
              <h3 className="lf-mentor-card__name">{favorite.mentorName}</h3>
              {favorite.mentorVerified && (
                <span className="lf-mentor-card__verified">
                  <Icon name="verified" />
                </span>
              )}
              {liveNow && <span className="lf-mentor-card__live-badge">Live</span>}
            </div>

            <p className="lf-mentor-card__role">
              {favorite.headline ? (
                <>
                  {favorite.headline}
                  {favorite.company ? (
                    <span className="lf-mentor-card__company"> @ {favorite.company}</span>
                  ) : null}
                </>
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
              {languages.length > 0 && (
                <>
                  <span className="lf-mentor-card__stat-divider" />
                  <span className="lf-mentor-card__stat">
                    <Icon name="translate" />
                    <span className="lf-mentor-card__stat-val">
                      {languages.slice(0, 2).join(", ")}
                    </span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="lf-mentor-card__right">
          <div className="lf-mentor-card__price-card">
            <span className="lf-mentor-card__price-label">Starting from</span>
            <span className="lf-mentor-card__price-value">
              ₹{price != null ? Number(price).toFixed(0) : "Free"}
            </span>
            <span className="lf-mentor-card__price-unit">/session</span>
          </div>

          <div className="lf-mentor-card__actions">
            <Link
              to={`/mentors/${id}`}
              className="lf-mentor-card__action-btn lf-mentor-card__action-btn--primary"
              title="Book a session"
            >
              <Icon name="calendar_month" /> Book
            </Link>
            <Link
              to={`/mentors/${id}`}
              className="lf-mentor-card__action-btn lf-mentor-card__action-btn--secondary"
              title="View mentor profile"
            >
              <Icon name="person" /> Profile
            </Link>
          </div>
          <Link to={`/mentors/${id}`} className="lf-mentor-card__view-btn">
            View Profile
          </Link>
          <button
            type="button"
            className={`lf-mentor-card__save is-saved${pending ? " is-pending" : ""}`}
            onClick={() => onRemove(id)}
            disabled={pending}
            aria-busy={pending}
            aria-pressed
            aria-label={pending ? "Removing favorite" : "Remove mentor from favorites"}
          >
            {pending ? (
              <span className="lf-heart-spinner" aria-hidden="true" />
            ) : (
              <Icon name="favorite" />
            )}
          </button>
        </div>
      </div>
    </article>
  );
}

const PAGE_SIZE = 6;

export default function LearnerSavedMentorsPage({ notify }) {
  useDocumentTitle("My Favorite Mentors");
  const { favorites, loading, isPending, toggleFavorite, refresh } = useFavorites({ notify });
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let list = favorites;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((favorite) => {
        const name = String(favorite.mentorName || "").toLowerCase();
        const skills = normalizeSkills(favorite.skills).join(" ").toLowerCase();
        const headline = String(favorite.headline || "").toLowerCase();
        return name.includes(q) || skills.includes(q) || headline.includes(q);
      });
    }

    const sorted = [...list];
    switch (sort) {
      case "rating":
        sorted.sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
        break;
      case "price_asc":
        sorted.sort((a, b) => {
          const pa = Number(a.minSessionPrice ?? a.hourlyRate ?? Infinity);
          const pb = Number(b.minSessionPrice ?? b.hourlyRate ?? Infinity);
          return pa - pb;
        });
        break;
      case "name":
        sorted.sort((a, b) =>
          String(a.mentorName || "").localeCompare(String(b.mentorName || "")),
        );
        break;
      case "recent":
      default:
        sorted.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
        );
        break;
    }
    return sorted;
  }, [favorites, query, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleRemove = async (id) => {
    const previousPageCount = filtered.length;
    try {
      await toggleFavorite(id);
      // If we removed the last card on the current page, step back one page.
      if (pageItems.length === 1 && safePage > 0) {
        setPage(safePage - 1);
      }
    } catch {
      // useFavorites already rolled back + notified.
    }
    if (previousPageCount === 1 && safePage > 0) {
      setPage((p) => Math.max(0, p - 1));
    }
  };

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ═══ HERO ═══ */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>favorite</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>favorite</span>
            FAVORITES
          </div>
          <h1>My Favorite Mentors</h1>
          <p className="mp-hero__sub">
            Your shortlist of mentors you love — review their skills, ratings, and availability,
            or book a session any time.
          </p>
          <div className="mp-hero__actions" style={{ flexWrap: "wrap", gap: 8 }}>
            <label
              className="lf-hero__search"
              style={{
                flex: 1,
                minWidth: 220,
                background: "rgba(255,255,255,0.10)",
                border: "1px solid rgba(255,255,255,0.15)",
              }}
            >
              <Icon name="search" style={{ color: "rgba(255,255,255,0.60)" }} />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search saved mentors by name or skill…"
                aria-label="Search favorite mentors"
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
            <label
              className="lf-hero__select"
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                color: "#fff",
                borderRadius: "var(--mp-radius)",
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Icon name="sort" style={{ color: "rgba(255,255,255,0.60)", fontSize: 18 }} />
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(0);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontWeight: 600,
                  fontSize: "0.82rem",
                  outline: "none",
                }}
              >
                <option value="recent" style={{ color: "#111" }}>Most Recent</option>
                <option value="rating" style={{ color: "#111" }}>Top Rated</option>
                <option value="price_asc" style={{ color: "#111" }}>Lowest Price</option>
                <option value="name" style={{ color: "#111" }}>Name A–Z</option>
              </select>
            </label>
          </div>
        </div>
      </section>

      {/* ═══ STATS ═══ */}
      <div className="mp-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", marginTop: 16 }}>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>favorite</span></div>
          </div>
          <p className="mp-stat__value">{favorites.length}</p>
          <p className="mp-stat__label">Saved Mentors</p>
          <p className="mp-stat__desc">Your shortlist</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>star</span></div>
          </div>
          <p className="mp-stat__value">
            {favorites.length
              ? (
                  favorites.reduce((s, f) => s + Number(f.averageRating || 0), 0) / favorites.length
                ).toFixed(1)
              : "—"}
          </p>
          <p className="mp-stat__label">Avg Rating</p>
          <p className="mp-stat__desc">Across your favorites</p>
        </div>
        <div className="mp-stat">
          <div className="mp-stat__top">
            <div className="mp-stat__icon"><span className="material-symbols-outlined" style={{ fontSize: 22 }}>translate</span></div>
          </div>
          <p className="mp-stat__value">
            {new Set(favorites.flatMap((f) => normalizeSkills(f.languages))).size}
          </p>
          <p className="mp-stat__label">Languages</p>
          <p className="mp-stat__desc">Among saved mentors</p>
        </div>
      </div>

      {/* ═══ RESULTS ═══ */}
      <div className="lf-results-header md-animate" style={{ marginTop: 20 }}>
        <h2 className="lf-results-title">
          {query ? `Results for "${query}"` : "All favorites"}
        </h2>
        {!loading && (
          <span className="lf-results-count">
            {filtered.length} mentor{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {loading ? (
        <div className="lf-grid md-animate">
          {[1, 2, 3].map((k) => (
            <div key={k} className="lf-skel-card">
              <div className="lf-skel-inner">
                <div className="lf-skel-left">
                  <div className="lf-skel-avatar" />
                  <div className="lf-skel-body">
                    <div className="lf-skel-line lf-skel-line--50" />
                    <div className="lf-skel-line lf-skel-line--70" />
                    <div className="lf-skel-skills">
                      <div className="lf-skel-pill" />
                      <div className="lf-skel-pill" />
                    </div>
                  </div>
                </div>
                <div className="lf-skel-right">
                  <div className="lf-skel-price" />
                  <div className="lf-skel-btn" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : pageItems.length > 0 ? (
        <>
          <div className="lf-grid md-animate">
            {pageItems.map((favorite) => (
              <FavoriteMentorCard
                key={favoriteMentorId(favorite)}
                favorite={favorite}
                pending={isPending(favoriteMentorId(favorite))}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="lf-pagination md-animate" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 24 }}>
              <button
                type="button"
                className="lf-btn lf-btn--outline lf-btn--sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                aria-label="Previous page"
              >
                <Icon name="chevron_left" /> Prev
              </button>
              <span className="lf-pagination__info" style={{ alignSelf: "center", fontSize: "0.85rem", color: "var(--md-muted)", padding: "0 8px" }}>
                Page {safePage + 1} of {totalPages}
              </span>
              <button
                type="button"
                className="lf-btn lf-btn--outline lf-btn--sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                aria-label="Next page"
              >
                Next <Icon name="chevron_right" />
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="lf-empty-state md-animate">
          <div className="lf-empty-state__icon-wrap">
            <Icon name="favorite_border" />
          </div>
          <div className="lf-empty-state__content">
            <h3 className="lf-empty-state__title">
              {query ? `No saved mentors matching "${query}"` : "No favorite mentors yet"}
            </h3>
            <p className="lf-empty-state__desc">
              {query
                ? "Try a different keyword, or clear your search to see all saved mentors."
                : "Tap the heart on any mentor card in Find Mentors to save them here for quick access."}
            </p>
            {query ? (
              <button type="button" className="lf-btn lf-btn--outline" onClick={() => setQuery("")}>
                <Icon name="close" /> Clear search
              </button>
            ) : (
              <Link to="/learner/mentors" className="lf-btn lf-btn--primary">
                <Icon name="person_search" /> Find Mentors
              </Link>
            )}
          </div>
        </div>
      )}

      <div style={{ textAlign: "center", marginTop: 24 }}>
        <button type="button" className="lf-btn lf-btn--ghost lf-btn--sm" onClick={refresh}>
          <Icon name="refresh" /> Refresh favorites
        </button>
      </div>
    </div>
  );
}
