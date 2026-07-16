import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import SectionCard, {
  EmptyState,
} from "../modules/common/dashboard/SectionCard";
import StatsCard from "../modules/common/dashboard/StatsCard";
import "./LearnerPages.css";

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

async function apiPut(path, body, config) {
  const response = await client.put(path, body, config);
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
  const [state, setState] = useState({
    loading: true,
    data: null,
    error: null,
  });

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

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "TBD";
  }
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDuration(startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "TBD";
  }
  const minutes = Math.max(
    0,
    Math.round((end.getTime() - start.getTime()) / 60000),
  );
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${minutes} min`;
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function splitSkills(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => splitSkills(item))
      .map((part) => part.trim())
      .filter(Boolean);
  }

  const text = String(value).trim();
  if (!text) {
    return [];
  }

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
      // fall through to delimiter parsing
    }
  }

  return text
    .split(/[\n,;|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseMilestones(value) {
  return splitSkills(value).map((entry, index) => ({
    id: `${index}-${entry}`,
    title: entry,
  }));
}

function useLearnerLearningData(refreshKey = 0) {
  return useResource(async () => {
    const [
      roadmaps,
      bookings,
      certifications,
      savedMentors,
      savedSkills,
      profile,
      referral,
    ] = await Promise.all([
      apiGet("/api/v1/roadmaps"),
      apiGet("/api/v1/bookings"),
      apiGet("/api/v1/certifications/me"),
      apiGet("/api/v1/users/mentors").catch(() => []),
      apiGet("/api/v1/watchlist/mentors").catch(() => []),
      apiGet("/api/v1/watchlist/skills").catch(() => []),
      apiGet("/api/v1/users/me"),
      apiGet("/api/v1/users/me/referral").catch(() => null),
    ]);

    return {
      roadmaps: roadmaps || [],
      bookings: bookings || [],
      certifications: certifications || [],
      mentors: mentors || [],
      savedMentors: savedMentors || [],
      savedSkills: savedSkills || [],
      profile,
      referral,
    };
  }, [refreshKey]);
}





function useNotificationsData(refreshKey = 0) {
  return useResource(async () => {
    const [notifications, preferences] = await Promise.all([
      apiGet("/api/v1/notifications"),
      apiGet("/api/v1/notifications/preferences").catch(() => null),
    ]);

    return { notifications: notifications || [], preferences };
  }, [refreshKey]);
}

function useMessagesData(refreshKey = 0) {
  return useResource(async () => {
    const conversations = await apiGet("/api/v1/chat/conversations");
    return { conversations: conversations || [], refreshKey };
  }, [refreshKey]);
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="lp-header md-animate">
      <div>
        <h1 className="lp-title">{title}</h1>
        <p className="lp-subtitle">{subtitle}</p>
      </div>
      {actions ? <div className="lp-header__actions">{actions}</div> : null}
    </div>
  );
}



function ProgressBar({ value, label }) {
  const next = clamp(Number(value || 0), 0, 100);
  return (
    <div>
      <div className="md-progress-track">
        <div className="md-progress-fill" style={{ width: `${next}%` }} />
      </div>
      {label ? <p className="md-progress-label">{label}</p> : null}
    </div>
  );
}

function LoadingBlock({ title = "Loading data" }) {
  return (
    <div className="md-empty">
      <div className="md-empty__icon">
        <Icon name="hourglass_top" />
      </div>
      <p className="md-empty__title">{title}</p>
      <p className="md-empty__desc">
        Fetching the latest learner data from the backend.
      </p>
    </div>
  );
}

function ErrorBlock({ title, error, onRetry }) {
  return (
    <EmptyState
      icon="error"
      title={title}
      description={error}
      actionLabel={onRetry ? "Retry" : undefined}
      onAction={onRetry}
    />
  );
}


function SessionCard({ booking }) {
  const session = booking?.session || {};
  const mentor = session?.mentor || {};
  const status = String(booking?.bookingStatus || "PENDING").toUpperCase();
  const badgeClass =
    status === "COMPLETED"
      ? "md-badge--ok"
      : status === "CONFIRMED" || status === "ACCEPTED"
        ? "md-badge--info"
        : status === "CANCELLED"
          ? "md-badge--wait"
          : "md-badge--info";

  return (
    <article className="lp-session-card md-animate">
      <div className="lp-session-main">
        <div className="lp-session-avatar">
          {initials(mentor.fullName || "Session")}
        </div>
        <div>
          <h3>{session.title || "Untitled session"}</h3>
          <p>{mentor.fullName || "Mentor unavailable"}</p>
          <p>
            {formatDateTime(session.startTime)} ·{" "}
            {formatDuration(session.startTime, session.endTime)}
          </p>
        </div>
      </div>
      <div className="lp-session-side">
        <span className={`md-badge ${badgeClass}`}>{status}</span>
        {session.meetingLink ? (
          <a
            href={session.meetingLink}
            className="lp-session-link"
            target="_blank"
            rel="noreferrer"
          >
            Meeting link
          </a>
        ) : (
          <span className="lp-session-link">Link not available</span>
        )}
        <div className="lp-session-actions">
          <Link
            to="/learner/messages"
            className="md-btn md-btn--brand md-btn--sm"
          >
            Open Chat
          </Link>
          <Link
            to="/learner/path"
            className="md-btn md-btn--outline md-btn--sm"
          >
            View Roadmap
          </Link>
        </div>
      </div>
    </article>
  );
}

function CertificateCard({ certificate }) {
  return (
    <article className="lp-certificate-card md-animate">
      <div
        className="lp-certificate-preview"
        style={{
          background:
            "linear-gradient(135deg, #0f766e 0%, rgba(255,255,255,0.18) 100%)",
        }}
      >
        <Icon name="workspace_premium" />
      </div>
      <div className="lp-certificate-body">
        <h3>{certificate.title}</h3>
        <p>{certificate.description}</p>
        <dl>
          <div>
            <dt>Issued</dt>
            <dd>{formatDate(certificate.issuedAt)}</dd>
          </div>
          <div>
            <dt>Certificate ID</dt>
            <dd>{certificate.certificateId}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function ChatBubble({ message, fromMe }) {
  const className = `lp-bubble${fromMe ? " is-me" : ""}`;
  return (
    <div className={className}>
      <p>{message.content}</p>
      <small>{formatDateTime(message.createdAt)}</small>
    </div>
  );
}

function DetailCard({
  title,
  icon,
  children,
  action,
  actionTo,
  danger = false,
}) {
  return (
    <SectionCard
      title={title}
      icon={icon}
      action={action}
      actionTo={actionTo}
      className={danger ? "lp-detail-card is-danger" : "lp-detail-card"}
    >
      {children}
    </SectionCard>
  );
}

function resolveMentorId(savedMentor) {
  return (
    savedMentor?.mentor?.id ?? savedMentor?.mentorId ?? savedMentor?.id ?? null
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium skeleton card for mentor loading state
// ─────────────────────────────────────────────────────────────────────────────
function MentorSkeletonCard() {
  return (
    <div className="lp-skeleton-card">
      <div style={{ height: 72, borderRadius: 14, marginBottom: 8 }} className="lp-skeleton" />
      <div className="lp-skeleton-header" style={{ marginTop: 8 }}>
        <div className="lp-sk-avatar lp-skeleton" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="lp-sk-line-lg lp-skeleton" />
          <div className="lp-sk-line-sm lp-skeleton" style={{ width: '45%' }} />
        </div>
      </div>
      <div className="lp-sk-line-full lp-skeleton" />
      <div className="lp-sk-line-md lp-skeleton" />
      <div className="lp-sk-row"><div className="lp-sk-block lp-skeleton" /><div className="lp-sk-block lp-skeleton" /><div className="lp-sk-block lp-skeleton" /></div>
      <div className="lp-sk-btn-row"><div className="lp-sk-btn lp-skeleton" /><div className="lp-sk-btn lp-skeleton" /></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium mentor card
// ─────────────────────────────────────────────────────────────────────────────
function PremiumMentorCard({ mentor, saved, onSaveToggle, rawData }) {
  const skills = mentor.skills || [];
  const rating = Number(mentor.averageRating || rawData?.averageRating || 0);
  const reviews = Number(mentor.totalReviews || rawData?.totalReviews || 0);
  const sessions = Number(rawData?.totalCompletedSessions || 0);
  const price = rawData?.minSessionPrice;
  const bio = rawData?.bio || mentor.aboutMe || null;
  const liveNow = mentor.liveNow || rawData?.liveNow || false;

  return (
    <article className="lp-mentor-card--premium">
      {/* Gradient header bar */}
      <div className="lp-mcard__header">
        <div className="lp-mcard__avatar-wrap">
          {mentor.profileImageUrl ? (
            <img className="lp-mcard__avatar" src={mentor.profileImageUrl} alt={mentor.fullName} />
          ) : (
            <div className="lp-mcard__avatar lp-mcard__avatar--fallback">{initials(mentor.fullName)}</div>
          )}
          <span className={`lp-mcard__online${liveNow ? ' is-live' : ''}`} />
        </div>
        <button
          type="button"
          className={`lp-mcard__save${saved ? ' is-saved' : ''}`}
          onClick={() => onSaveToggle(mentor.id)}
          aria-label={saved ? 'Remove saved mentor' : 'Save mentor'}
        >
          <Icon name={saved ? 'bookmark' : 'bookmark_border'} />
        </button>
      </div>

      {/* Body */}
      <div className="lp-mcard__body">
        <div>
          <div className="lp-mcard__top-row">
            <h3 className="lp-mcard__name">{mentor.fullName}</h3>
            {mentor.mentorVerified && (
              <span className="lp-mcard__verified"><Icon name="verified" /> Verified</span>
            )}
          </div>
          <p className="lp-mcard__role">{liveNow ? '🟢 Online now · Mentor' : 'Mentor'}</p>
        </div>

        {/* Rating */}
        <div className="lp-mcard__rating">
          <span className="lp-mcard__rating-val">{rating.toFixed(1)}</span>
          <div className="lp-mcard__stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Icon key={i} name="star" className={i < Math.round(rating) ? 'is-on' : ''}
                style={i < Math.round(rating) ? { fontVariationSettings: '"FILL" 1' } : undefined} />
            ))}
          </div>
          <span className="lp-mcard__reviews">({reviews} reviews)</span>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div className="lp-mcard__skills">
            {skills.slice(0, 5).map((s) => <span key={s} className="lp-mcard__skill-chip">{s}</span>)}
            {skills.length > 5 && <span className="lp-mcard__skill-more">+{skills.length - 5}</span>}
          </div>
        )}

        {/* Bio */}
        {bio && <p className="lp-mcard__bio">{bio}</p>}

        {/* Meta grid */}
        <div className="lp-mcard__meta">
          <div className="lp-mcard__meta-item">
            <span className="lp-mcard__meta-val">{sessions}</span>
            <span className="lp-mcard__meta-lbl">Sessions</span>
          </div>
          <div className="lp-mcard__meta-item">
            <span className="lp-mcard__meta-val">{price ? `$${Number(price).toFixed(0)}` : 'Free'}</span>
            <span className="lp-mcard__meta-lbl">From</span>
          </div>
          <div className="lp-mcard__meta-item">
            <span className="lp-mcard__meta-val">{rating.toFixed(1)}</span>
            <span className="lp-mcard__meta-lbl">Rating</span>
          </div>
        </div>

        {/* Actions */}
        <div className="lp-mcard__actions">
          <Link to="/learner/sessions" className="md-btn md-btn--brand md-btn--sm">Book Session</Link>
          <Link to={`/mentors/${mentor.id}`} className="md-btn md-btn--outline md-btn--sm">View Profile</Link>
        </div>
      </div>
    </article>
  );
}

export function LearnerMentorsPage() {
  useDocumentTitle('Find Mentors');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [showFilters, setShowFilters] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const debouncedQuery = useDebouncedValue(query, 350);

  const { loading, data, error } = useResource(async () => {
    const [mentorResults, savedMentors] = await Promise.all([
      apiGet('/api/v1/search/mentors', {
        params: {
          ...(debouncedQuery ? { q: debouncedQuery } : {}),
          sort,
          ...(minRating > 0 ? { minRating } : {}),
          size: 40,
        },
      }),
      apiGet('/api/v1/watchlist/mentors').catch(() => []),
    ]);
    return { mentors: mentorResults || [], savedMentors: savedMentors || [] };
  }, [debouncedQuery, sort, minRating, refreshKey]);

  const rawMentors = data?.mentors || [];
  const savedMentors = data?.savedMentors || [];

  // Normalise raw search results
  const liveMentors = useMemo(() => rawMentors.map((m) => ({
    id: m.mentorId,
    fullName: m.mentorName,
    skills: splitSkills(m.skills),
    profileImageUrl: m.profileImageUrl,
    averageRating: Number(m.averageRating || 0),
    totalReviews: Number(m.totalReviews || 0),
    liveNow: Boolean(m.liveNow),
    mentorVerified: Boolean(m.mentorVerified),
  })), [rawMentors]);

  const savedMentorIds = useMemo(() => new Set(
    savedMentors.map((i) => i?.mentor?.id ?? i?.mentorId ?? i?.id).filter(Boolean)
  ), [savedMentors]);

  const averageRating = liveMentors.length
    ? liveMentors.reduce((s, m) => s + m.averageRating, 0) / liveMentors.length
    : 0;

  async function toggleMentorSave(mentorId) {
    const isSaved = savedMentorIds.has(mentorId);
    try {
      if (isSaved) await apiDelete(`/api/v1/watchlist/mentors/${mentorId}`);
      else await apiPost(`/api/v1/watchlist/mentors/${mentorId}`);
      setRefreshKey((v) => v + 1);
    } catch (e) { window.console.error(e); }
  }

  return (
    <div className="lp-shell md">
      {/* ── Hero ── */}
      <div className="lp-hero md-animate">
        <div className="lp-hero__eyebrow"><Icon name="person_search" /> Mentor Marketplace</div>
        <h1>Find Your Perfect Mentor</h1>
        <p className="lp-hero__sub">
          Discover expert mentors across 100+ skills. Book 1-on-1 sessions, save favourites, and accelerate your growth.
        </p>
        <div className="lp-hero__actions">
          <label className="lp-hero__search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, skill, or technology…"
              id="mentor-search-input"
            />
            {loading && query ? <span className="lp-search-loading" /> : null}
            {query && !loading && (
              <button type="button" className="lp-hero__search-clear" onClick={() => setQuery('')}
                aria-label="Clear search">
                <Icon name="close" />
              </button>
            )}
          </label>
          <button
            type="button"
            className={`md-btn md-btn--outline md-btn--sm${showFilters ? ' is-active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <Icon name="tune" /> Filters
          </button>
          <label className="lp-select" style={{ minWidth: 160 }}>
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

      {/* ── Filter panel ── */}
      {showFilters && (
        <div className="lp-filter-panel md-animate">
          <div className="lp-filter-group">
            <label>Min Rating</label>
            <select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
              <option value={0}>Any rating</option>
              <option value={3}>3★ and above</option>
              <option value={4}>4★ and above</option>
              <option value={4.5}>4.5★ and above</option>
            </select>
          </div>
          <div className="lp-filter-group">
            <label>Sort By</label>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="recent">Most Recent</option>
              <option value="rating">Top Rated</option>
              <option value="reviews">Most Reviews</option>
              <option value="sessions">Most Sessions</option>
              <option value="price_asc">Lowest Price</option>
            </select>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="ld-stats md-animate">
        <StatsCard icon="group" label="Total Mentors" value={liveMentors.length} description="Loaded from backend" />
        <StatsCard icon="wifi_tethering" label="Online Now" value={liveMentors.filter((m) => m.liveNow).length} description="Active mentors" />
        <StatsCard icon="bookmark" label="Saved Mentors" value={savedMentors.length} description="Your shortlist" />
        <StatsCard icon="star" label="Avg Rating" value={averageRating.toFixed(1)} description="Across all mentors" />
      </div>

      {/* ── Mentor grid ── */}
      <div>
        <div className="lp-section-head">
          <h2><Icon name="person_search" /> {debouncedQuery ? `Results for "${debouncedQuery}"` : 'All Mentors'}</h2>
          {!loading && <span style={{ fontSize: '0.84rem', color: 'var(--md-muted)' }}>{liveMentors.length} mentor{liveMentors.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className="lp-grid--mentor">
            {[1, 2, 3, 4, 5, 6].map((k) => <MentorSkeletonCard key={k} />)}
          </div>
        ) : error ? (
          <ErrorBlock title="Mentors could not be loaded" error={error} onRetry={() => setRefreshKey((v) => v + 1)} />
        ) : liveMentors.length > 0 ? (
          <div className="lp-grid--mentor md-animate">
            {liveMentors.map((mentor, idx) => (
              <PremiumMentorCard
                key={mentor.id}
                mentor={mentor}
                rawData={rawMentors[idx]}
                saved={savedMentorIds.has(mentor.id)}
                onSaveToggle={toggleMentorSave}
              />
            ))}
          </div>
        ) : (
          <div className="lp-empty--premium">
            <div className="lp-empty__icon-wrap"><Icon name="search_off" /></div>
            <p className="lp-empty__title">No mentors found</p>
            <p className="lp-empty__desc">
              {query ? `No mentors match "${query}". Try a different keyword or clear your filters.` : 'No mentors are available right now. Check back soon.'}
            </p>
            {query && (
              <button type="button" className="md-btn md-btn--outline md-btn--sm" onClick={() => setQuery('')}>
                Clear search
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Saved mentors ── */}
      {savedMentors.length > 0 && (
        <div>
          <div className="lp-section-head">
            <h2><Icon name="bookmark" /> Saved Mentors</h2>
          </div>
          <div className="lp-grid--mentor md-animate">
            {savedMentors.map((item) => {
              const mentor = item?.mentor || {};
              const mentorId = resolveMentorId(item);
              const normalized = {
                id: mentorId,
                fullName: mentor.fullName || item.fullName || 'Saved mentor',
                skills: splitSkills(mentor.skills || item.skills),
                profileImageUrl: mentor.profileImageUrl || item.profileImageUrl,
                averageRating: Number(mentor.averageRating || item.averageRating || 0),
                totalReviews: Number(mentor.totalReviews || item.totalReviews || 0),
                liveNow: Boolean(mentor.liveNow || item.liveNow),
                mentorVerified: Boolean(mentor.mentorVerified),
              };
              return (
                <PremiumMentorCard
                  key={item.id || mentorId}
                  mentor={normalized}
                  rawData={null}
                  saved
                  onSaveToggle={toggleMentorSave}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function LearnerSavedMentorsPage() {
  return <Navigate to="/learner/mentors" replace />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill icon colours mapping — deterministic by category
// ─────────────────────────────────────────────────────────────────────────────
const SKILL_GRADIENTS = [
  'linear-gradient(135deg,#0f766e,#14b8a6)',
  'linear-gradient(135deg,#1d4ed8,#3b82f6)',
  'linear-gradient(135deg,#7c3aed,#a78bfa)',
  'linear-gradient(135deg,#b45309,#f59e0b)',
  'linear-gradient(135deg,#be123c,#f43f5e)',
  'linear-gradient(135deg,#0369a1,#38bdf8)',
  'linear-gradient(135deg,#065f46,#34d399)',
  'linear-gradient(135deg,#6b21a8,#d946ef)',
];

const SKILL_ICONS = {
  programming: 'code',
  frontend: 'web',
  backend: 'dns',
  cloud: 'cloud',
  ai: 'psychology',
  devops: 'terminal',
  'cyber security': 'security',
  'data science': 'analytics',
  default: 'auto_stories',
};

function skillIcon(category) {
  return SKILL_ICONS[(category || '').toLowerCase()] || SKILL_ICONS.default;
}

function skillGradient(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return SKILL_GRADIENTS[h % SKILL_GRADIENTS.length];
}

const CATEGORIES = [
  { label: 'All', icon: 'apps', value: '' },
  { label: 'Programming', icon: 'code', value: 'Programming' },
  { label: 'Frontend', icon: 'web', value: 'Frontend' },
  { label: 'Backend', icon: 'dns', value: 'Backend' },
  { label: 'Cloud', icon: 'cloud', value: 'Cloud' },
  { label: 'AI / ML', icon: 'psychology', value: 'AI' },
  { label: 'DevOps', icon: 'terminal', value: 'DevOps' },
  { label: 'Cyber Security', icon: 'security', value: 'Cyber Security' },
  { label: 'Data Science', icon: 'analytics', value: 'Data Science' },
];

const LEARNING_PATHS = [
  { name: 'Full-Stack Development', icon: 'layers', difficulty: 'Intermediate', duration: '6 months', grad: 'linear-gradient(135deg,#0f766e,#14b8a6)', skills: ['React', 'Node.js', 'PostgreSQL'] },
  { name: 'Cloud & DevOps', icon: 'cloud', difficulty: 'Advanced', duration: '4 months', grad: 'linear-gradient(135deg,#1d4ed8,#38bdf8)', skills: ['AWS', 'Docker', 'Kubernetes'] },
  { name: 'AI & Machine Learning', icon: 'psychology', difficulty: 'Advanced', duration: '8 months', grad: 'linear-gradient(135deg,#7c3aed,#a78bfa)', skills: ['Python', 'TensorFlow', 'PyTorch'] },
  { name: 'Mobile Development', icon: 'smartphone', difficulty: 'Beginner', duration: '3 months', grad: 'linear-gradient(135deg,#be123c,#f43f5e)', skills: ['React Native', 'Flutter'] },
  { name: 'Data Engineering', icon: 'analytics', difficulty: 'Intermediate', duration: '5 months', grad: 'linear-gradient(135deg,#b45309,#f59e0b)', skills: ['Spark', 'Kafka', 'Airflow'] },
];

function SkillSkeletonCard() {
  return (
    <div className="lp-skeleton-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ height: 80 }} className="lp-skeleton" />
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="lp-sk-line-lg lp-skeleton" />
        <div className="lp-sk-line-sm lp-skeleton" style={{ width: '50%' }} />
        <div className="lp-sk-line-sm lp-skeleton" style={{ width: '70%' }} />
      </div>
    </div>
  );
}

export function LearnerSkillsPage() {
  useDocumentTitle('Explore Skills');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const debouncedQuery = useDebouncedValue(query, 350);

  const { loading, data, error } = useResource(async () => {
    const [skills, mentors, savedSkills] = await Promise.all([
      apiGet('/api/v1/skills', { params: debouncedQuery ? { q: debouncedQuery } : undefined }),
      apiGet('/api/v1/users/mentors').catch(() => []),
      apiGet('/api/v1/watchlist/skills').catch(() => []),
    ]);
    return { skills: skills || [], mentors: mentors || [], savedSkills: savedSkills || [] };
  }, [debouncedQuery, refreshKey]);

  const skills = data?.skills || [];
  const mentors = data?.mentors || [];
  const savedSkills = data?.savedSkills || [];

  // Use mentorCount from API if available (enriched DTO), otherwise compute locally
  const mentorSkillCounts = useMemo(() => {
    const counts = new Map();
    if (skills.length && skills[0]?.mentorCount !== undefined) {
      skills.forEach((s) => counts.set(s.name.toLowerCase(), s.mentorCount));
    } else {
      mentors.forEach((m) => splitSkills(m.skills).forEach((sk) => {
        const k = sk.toLowerCase(); counts.set(k, (counts.get(k) || 0) + 1);
      }));
    }
    return counts;
  }, [skills, mentors]);

  const savedSkillNames = useMemo(
    () => new Set(savedSkills.map((i) => String(i?.skillName || i?.name || '').toLowerCase())),
    [savedSkills],
  );

  // Filter by category after API search
  const filteredSkills = useMemo(() => {
    if (!category) return skills;
    return skills.filter((s) => (s.category || '').toLowerCase().includes(category.toLowerCase()));
  }, [skills, category]);

  const trendingCount = useMemo(
    () => [...mentorSkillCounts.values()].filter((c) => c >= 2).length,
    [mentorSkillCounts],
  );

  async function toggleSkillWatch(skillName) {
    const normalized = skillName.toLowerCase();
    try {
      if (savedSkillNames.has(normalized)) {
        await apiDelete(`/api/v1/watchlist/skills/${encodeURIComponent(skillName)}`);
      } else {
        await apiPost('/api/v1/watchlist/skills', { skillName });
      }
      setRefreshKey((v) => v + 1);
    } catch (e) { window.console.error(e); }
  }

  return (
    <div className="lp-shell md">
      {/* ── Hero ── */}
      <div className="lp-hero md-animate">
        <div className="lp-hero__eyebrow"><Icon name="auto_stories" /> Skill Explorer</div>
        <h1>Explore Skills & Learning Paths</h1>
        <p className="lp-hero__sub">
          Browse hundreds of in-demand skills, find expert mentors, and start your personalised learning journey today.
        </p>
        <div className="lp-hero__actions">
          <label className="lp-hero__search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search skills, categories, technologies…"
              id="skill-search-input"
            />
            {loading && query ? <span className="lp-search-loading" /> : null}
            {query && !loading && (
              <button type="button" className="lp-hero__search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="close" />
              </button>
            )}
          </label>
        </div>
      </div>

      {/* ── Category pills ── */}
      <div className="lp-category-pills md-animate">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            className={`lp-category-pill${category === cat.value ? ' is-active' : ''}`}
            onClick={() => setCategory(cat.value)}
          >
            <Icon name={cat.icon} />{cat.label}
          </button>
        ))}
      </div>

      {/* ── Stats ── */}
      <div className="ld-stats md-animate">
        <StatsCard icon="auto_stories" label="Total Skills" value={skills.length} description="In the catalogue" />
        <StatsCard icon="groups" label="Active Mentors" value={mentors.length} description="Teaching mentors" />
        <StatsCard icon="bookmark" label="Saved Skills" value={savedSkills.length} description="On your watchlist" />
        <StatsCard icon="trending_up" label="Trending" value={trendingCount} description="High mentor activity" />
      </div>

      {/* ── Skills grid ── */}
      <div>
        <div className="lp-section-head">
          <h2>
            <Icon name="grid_view" />
            {category ? `${category} Skills` : (debouncedQuery ? `Results for "${debouncedQuery}"` : 'Popular Skills')}
          </h2>
          {!loading && <span style={{ fontSize: '0.84rem', color: 'var(--md-muted)' }}>{filteredSkills.length} skill{filteredSkills.length !== 1 ? 's' : ''}</span>}
        </div>

        {loading ? (
          <div className="lp-grid--skills-premium">
            {[1,2,3,4,5,6,7,8].map((k) => <SkillSkeletonCard key={k} />)}
          </div>
        ) : error ? (
          <ErrorBlock title="Skills could not be loaded" error={error} onRetry={() => setRefreshKey((v) => v + 1)} />
        ) : filteredSkills.length > 0 ? (
          <div className="lp-grid--skills-premium md-animate">
            {filteredSkills.map((skill) => {
              const mentorCount = mentorSkillCounts.get(skill.name.toLowerCase()) || skill.mentorCount || 0;
              const learnerCount = skill.learnerCount || 0;
              const saved = savedSkillNames.has(skill.name.toLowerCase());
              return (
                <article key={skill.id || skill.name} className="lp-skill-card--premium">
                  <div className="lp-scard__icon-header" style={{ background: skillGradient(skill.name) }}>
                    <Icon name={skillIcon(skill.category)} />
                    <button
                      type="button"
                      className={`lp-scard__save${saved ? ' is-saved' : ''}`}
                      onClick={() => toggleSkillWatch(skill.name)}
                      aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
                    >
                      <Icon name={saved ? 'bookmark' : 'bookmark_border'} />
                    </button>
                  </div>
                  <div className="lp-scard__body">
                    <h3 className="lp-scard__name">{skill.name}</h3>
                    <span className="lp-scard__category">{skill.category || 'General'}</span>
                    <div className="lp-scard__counts">
                      <div className="lp-scard__count-item"><Icon name="person" /><strong>{mentorCount}</strong> mentors</div>
                      <div className="lp-scard__count-item"><Icon name="school" /><strong>{learnerCount}</strong> learners</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="lp-empty--premium">
            <div className="lp-empty__icon-wrap"><Icon name="search_off" /></div>
            <p className="lp-empty__title">No skills found</p>
            <p className="lp-empty__desc">
              {query ? `No skills match "${query}".` : 'No skills match the selected category.'} Try a different search or clear your filters.
            </p>
            <button type="button" className="md-btn md-btn--outline md-btn--sm" onClick={() => { setQuery(''); setCategory(''); }}>Clear filters</button>
          </div>
        )}
      </div>

      {/* ── Learning Paths ── */}
      <div>
        <div className="lp-section-head">
          <h2><Icon name="route" /> Learning Paths</h2>
          <Link to="/learner/path" className="md-btn md-btn--outline md-btn--sm">View All</Link>
        </div>
        <div className="lp-learning-paths md-animate">
          {LEARNING_PATHS.map((path) => {
            const mentorMatchCount = path.skills.reduce(
              (sum, sk) => sum + (mentorSkillCounts.get(sk.toLowerCase()) || 0), 0
            );
            return (
              <div key={path.name} className="lp-path-card--premium">
                <div className="lp-path-thumb--premium" style={{ background: path.grad }}>
                  <span className="lp-path-diff-badge">{path.difficulty}</span>
                  <Icon name={path.icon} />
                </div>
                <div className="lp-path-body--premium">
                  <h3>{path.name}</h3>
                  <div className="lp-path-meta-row">
                    <span className="lp-path-meta-chip"><Icon name="schedule" />{path.duration}</span>
                    <span className="lp-path-meta-chip"><Icon name="person" />{mentorMatchCount} mentors</span>
                  </div>
                  <div className="lp-mcard__skills" style={{ marginTop: 2 }}>
                    {path.skills.map((sk) => <span key={sk} className="lp-mcard__skill-chip">{sk}</span>)}
                  </div>
                  <Link to="/learner/mentors" className="md-btn md-btn--brand md-btn--sm" style={{ marginTop: 4 }}>Start Learning</Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Saved skills ── */}
      {savedSkills.length > 0 && (
        <div>
          <div className="lp-section-head">
            <h2><Icon name="bookmark" /> Saved Skills</h2>
          </div>
          <div className="lp-chip-list md-animate">
            {savedSkills.map((item) => (
              <button
                key={item.id || item.skillName}
                type="button"
                className="lp-saved-chip"
                onClick={() => toggleSkillWatch(item.skillName)}
                title="Click to remove from watchlist"
              >
                <Icon name="bookmark" />{item.skillName}
                <Icon name="close" style={{ fontSize: '0.75rem', opacity: 0.6 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildBookingStats(bookings) {
  const now = Date.now();
  const upcoming = bookings.filter((booking) => {
    const startTime = new Date(booking?.session?.startTime || 0).getTime();
    return Number.isFinite(startTime) && startTime >= now;
  });
  const completed = bookings.filter(
    (booking) =>
      String(booking?.bookingStatus || "").toUpperCase() === "COMPLETED",
  );
  const totalHours = completed.reduce((sum, booking) => {
    const start = new Date(booking?.session?.startTime || 0).getTime();
    const end = new Date(booking?.session?.endTime || 0).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
      return sum;
    return sum + (end - start) / 3600000;
  }, 0);
  return { upcoming, completed, totalHours };
}

function buildWeeklySeries(bookings) {
  const values = Array.from({ length: 6 }, (_, index) => ({
    label: `${5 - index}w`,
    value: 0,
  }));
  const now = Date.now();
  bookings.forEach((booking) => {
    const completed =
      String(booking?.bookingStatus || "").toUpperCase() === "COMPLETED";
    if (!completed) return;
    const startTime = new Date(booking?.session?.startTime || 0).getTime();
    if (!Number.isFinite(startTime)) return;
    const weeksAgo = Math.floor((now - startTime) / (7 * 86400000));
    if (weeksAgo >= 0 && weeksAgo < values.length) {
      values[values.length - 1 - weeksAgo].value += 1;
    }
  });
  return values;
}

function deriveRoadmapMilestones(roadmap) {
  return parseMilestones(roadmap?.milestones || "");
}

function LearningSummary({ data, onRefresh }) {
  const {
    roadmaps,
    bookings,
    certifications,
    savedMentors,
    savedSkills,
    profile,
  } = data;
  const { upcoming, completed, totalHours } = buildBookingStats(bookings);
  const activeRoadmap =
    roadmaps.find((roadmap) => Number(roadmap.progressPercent || 0) < 100) ||
    roadmaps[0] ||
    null;
  const weeklySeries = buildWeeklySeries(bookings);
  const profileCompletion = Number(profile?.profileCompletionPercent || 0);

  const achievements = useMemo(
    () => [
      {
        title: "Completed sessions",
        detail: `${completed.length} sessions closed from backend bookings.`,
        icon: "task_alt",
      },
      {
        title: "Certificates",
        detail: `${certifications.length} certificates issued on your account.`,
        icon: "workspace_premium",
      },
      {
        title: "Saved mentors",
        detail: `${savedMentors.length} mentor bookmarks stored in watchlist.`,
        icon: "bookmark",
      },
      {
        title: "Saved skills",
        detail: `${savedSkills.length} skills in your watchlist.`,
        icon: "school",
      },
      {
        title: "Profile completion",
        detail: `${profileCompletion}% complete according to /api/v1/users/me.`,
        icon: "person",
      },
      {
        title: "Learning hours",
        detail: `${Math.round(totalHours * 10) / 10} hours of completed sessions.`,
        icon: "schedule",
      },
    ],
    [
      certifications.length,
      completed.length,
      profileCompletion,
      savedMentors.length,
      savedSkills.length,
      totalHours,
    ],
  );

  return (
    <div className="lp-shell">
      <PageHeader
        title="Learning Path"
        subtitle="A backend-driven learning roadmap with progress, sessions, certificates, and real achievements."
        actions={
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={onRefresh}
          >
            Refresh
          </button>
        }
      />
      <div className="ld-stats md-animate">
        <StatsCard
          icon="route"
          label="Roadmaps"
          value={roadmaps.length}
          description="Current roadmap plans"
        />
        <StatsCard
          icon="event"
          label="Upcoming sessions"
          value={upcoming.length}
          description="Booked from backend"
        />
        <StatsCard
          icon="workspace_premium"
          label="Certificates"
          value={certifications.length}
          description="Issued certificates"
        />
        <StatsCard
          icon="schedule"
          label="Learning hours"
          value={Math.round(totalHours * 10) / 10}
          description="Completed session time"
        />
      </div>

      <div className="ld-row md-animate">
        <div className="ld-c8">
          <DetailCard title="Current learning" icon="school">
            {activeRoadmap ? (
              <div className="lp-learning-hero">
                <div>
                  <span className="md-badge md-badge--info">
                    {activeRoadmap.title}
                  </span>
                  <h3>{activeRoadmap.title}</h3>
                  <p>
                    Roadmap progress and milestones are loaded from the backend.
                  </p>
                </div>
                <div className="lp-learning-hero__stats">
                  <strong>{Number(activeRoadmap.progressPercent || 0)}%</strong>
                  <span>Progress</span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon="school"
                title="No learning roadmap yet"
                description="Book a session to generate a roadmap on the backend."
                actionLabel="Browse mentors"
                actionTo="/learner/mentors"
              />
            )}
          </DetailCard>
        </div>
        <div className="ld-c4">
          <DetailCard title="Career goals" icon="flag">
            <div className="lp-detail-stack">
              <div>
                <span>Profile completion</span>
                <strong>{profileCompletion}%</strong>
              </div>
              <div>
                <span>Primary skills</span>
                <strong>
                  {splitSkills(profile?.skills).slice(0, 3).join(", ") ||
                    "Add skills in profile"}
                </strong>
              </div>
              <div>
                <span>Referral code</span>
                <strong>
                  {profile?.referralCode || profile?.email || "Unavailable"}
                </strong>
              </div>
            </div>
          </DetailCard>
        </div>
      </div>

      <div className="ld-row md-animate">
        <div className="ld-c8">
          <DetailCard title="Roadmap timeline" icon="timeline">
            {activeRoadmap ? (
              <div className="lp-timeline">
                {deriveRoadmapMilestones(activeRoadmap).length ? (
                  deriveRoadmapMilestones(activeRoadmap).map((step, index) => (
                    <div className="lp-timeline__item" key={step.id}>
                      <span className="lp-timeline__dot">{index + 1}</span>
                      <div>
                        <strong>{step.title}</strong>
                        <p>{activeRoadmap.title}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    icon="timeline"
                    title="No milestones on this roadmap"
                    description="The backend roadmap exists but does not yet have milestones."
                  />
                )}
              </div>
            ) : (
              <EmptyState
                icon="timeline"
                title="No roadmap data"
                description="No roadmap records were returned for this learner."
              />
            )}
          </DetailCard>
        </div>
        <div className="ld-c4">
          <DetailCard title="Weekly analytics" icon="insights">
            <div className="lp-analytics">
              {weeklySeries.map((entry) => (
                <div className="lp-analytics__row" key={entry.label}>
                  <span>{entry.label}</span>
                  <div className="md-progress-track">
                    <div
                      className="md-progress-fill"
                      style={{ width: `${clamp(entry.value * 25, 4, 100)}%` }}
                    />
                  </div>
                  <strong>{entry.value}</strong>
                </div>
              ))}
            </div>
          </DetailCard>
        </div>
      </div>

      <div className="ld-row md-animate">
        <div className="ld-c8">
          <DetailCard
            title="Upcoming sessions"
            icon="event_available"
            action="Open sessions"
            actionTo="/learner/sessions"
          >
            {upcoming.length ? (
              <div className="lp-grid lp-grid--sessions">
                {upcoming.slice(0, 4).map((booking) => (
                  <SessionCard key={booking.id} booking={booking} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="event_busy"
                title="No upcoming sessions"
                description="Your future bookings will show up here automatically."
                actionLabel="Browse mentors"
                actionTo="/learner/mentors"
              />
            )}
          </DetailCard>
        </div>
        <div className="ld-c4">
          <DetailCard title="Achievements" icon="military_tech">
            <div className="lp-achievement-list">
              {achievements.map((item) => (
                <div className="lp-achievement" key={item.title}>
                  <Icon name={item.icon} />
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </DetailCard>
        </div>
      </div>

      <div className="ld-row md-animate">
        <div className="ld-c8">
          <DetailCard
            title="Certificates"
            icon="workspace_premium"
            action="View all"
            actionTo="/learner/certificates"
          >
            {certifications.length ? (
              <div className="lp-grid lp-grid--certificates">
                {certifications.slice(0, 4).map((certificate) => (
                  <CertificateCard
                    key={certificate.id}
                    certificate={certificate}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="workspace_premium"
                title="No certificates yet"
                description="Certificate data will appear after evaluations and completions."
              />
            )}
          </DetailCard>
        </div>
        <div className="ld-c4">
          <DetailCard title="Skill progress" icon="auto_stories">
            {savedSkills.length ? (
              <div className="lp-detail-stack">
                {savedSkills.map((skill) => (
                  <div key={skill.id || skill.skillName}>
                    <span>{skill.skillName}</span>
                    <ProgressBar value={100} label="Saved in watchlist" />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon="auto_stories"
                title="No skill watchlist"
                description="Add skills from the Explore Skills page to shape your roadmap."
                actionLabel="Explore skills"
                actionTo="/learner/skills"
              />
            )}
          </DetailCard>
        </div>
      </div>
    </div>
  );
}

export function LearnerLearningPage() {
  useDocumentTitle("My Learning");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  if (loading) return <LoadingBlock title="Loading my learning" />;
  if (error)
    return (
      <ErrorBlock
        title="Learning data could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  return (
    <LearningSummary
      data={data}
      onRefresh={() => setRefreshKey((value) => value + 1)}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Session skeleton card
// ─────────────────────────────────────────────────────────────────────────────
function SessionSkeletonCard() {
  return (
    <div className="lp-skeleton-card">
      <div className="lp-skeleton-header">
        <div className="lp-sk-avatar lp-skeleton" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="lp-sk-line-sm lp-skeleton" style={{ width: '40%' }} />
          <div className="lp-sk-line-lg lp-skeleton" />
        </div>
        <div className="lp-sk-btn lp-skeleton" style={{ width: 80 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {[1,2,3].map((k) => <div key={k} className="lp-skeleton" style={{ height: 32, borderRadius: 999, flex: 1 }} />)}
      </div>
      <div className="lp-sk-btn-row">
        <div className="lp-sk-btn lp-skeleton" />
        <div className="lp-sk-btn lp-skeleton" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Premium session card
// ─────────────────────────────────────────────────────────────────────────────
function PremiumSessionCard({ booking }) {
  const session = booking?.session || {};
  const mentor = session?.mentor || {};
  const rawStatus = String(booking?.bookingStatus || 'PENDING').toUpperCase();
  const statusKey = rawStatus === 'CONFIRMED' || rawStatus === 'ACCEPTED' ? 'UPCOMING' : rawStatus;

  const badgeClass = {
    UPCOMING: 'lp-badge--upcoming',
    COMPLETED: 'lp-badge--completed',
    CANCELLED: 'lp-badge--cancelled',
    PENDING: 'lp-badge--pending',
  }[statusKey] || 'lp-badge--pending';

  const statusLabel = {
    UPCOMING: 'Upcoming',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
    PENDING: 'Pending',
  }[statusKey] || rawStatus;

  const hasLink = Boolean(session.meetingLink);
  const isUpcoming = statusKey === 'UPCOMING' || statusKey === 'PENDING';
  const isCompleted = statusKey === 'COMPLETED';

  return (
    <article className="lp-session-card--premium">
      {/* Header */}
      <div className="lp-scrd__header">
        <div className="lp-scrd__avatar">
          {mentor.profileImageUrl
            ? <img src={mentor.profileImageUrl} alt={mentor.fullName} />
            : initials(mentor.fullName || 'Session')}
        </div>
        <div className="lp-scrd__info">
          <p className="lp-scrd__mentor">{mentor.fullName || 'Mentor unavailable'}</p>
          <p className="lp-scrd__title">{session.title || 'Untitled session'}</p>
        </div>
        <span className={`lp-status-badge ${badgeClass}`}>{statusLabel}</span>
      </div>

      {/* Date/time pills */}
      <div className="lp-scrd__pills">
        <span className="lp-scrd__pill"><Icon name="calendar_today" />{formatDate(session.startTime)}</span>
        <span className="lp-scrd__pill"><Icon name="schedule" />{formatDateTime(session.startTime).split(', ')[1] || '—'}</span>
        <span className="lp-scrd__pill"><Icon name="timelapse" />{formatDuration(session.startTime, session.endTime)}</span>
      </div>

      {/* Actions */}
      <div className="lp-scrd__actions">
        {isUpcoming && hasLink && (
          <a href={session.meetingLink} target="_blank" rel="noreferrer" className="md-btn md-btn--brand md-btn--sm">
            <Icon name="videocam" /> Join Session
          </a>
        )}
        {isUpcoming && (
          <Link to="/learner/messages" className="md-btn md-btn--outline md-btn--sm">
            <Icon name="chat" /> Message
          </Link>
        )}
        {isCompleted && (
          <>
            <Link to="/learner/sessions" className="md-btn md-btn--brand md-btn--sm">
              <Icon name="star" /> Rate Mentor
            </Link>
            <button type="button" className="md-btn md-btn--outline md-btn--sm">
              <Icon name="download" /> Notes
            </button>
          </>
        )}
        {!isUpcoming && !isCompleted && (
          <Link to="/learner/mentors" className="md-btn md-btn--outline md-btn--sm">
            <Icon name="person_search" /> Book Again
          </Link>
        )}
      </div>
    </article>
  );
}

export function LearnerSessionsPage() {
  useDocumentTitle('Booked Sessions');
  const [activeTab, setActiveTab] = useState('upcoming');
  const [viewMode, setViewMode] = useState('list');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const { loading, data, error } = useResource(
    () => apiGet('/api/v1/bookings'),
    [refreshKey],
  );
  const bookings = data || [];

  // ── grouping
  const grouped = useMemo(() => {
    const upcoming = [];
    const completed = [];
    const cancelled = [];
    bookings.forEach((booking) => {
      const status = String(booking?.bookingStatus || '').toUpperCase();
      if (status === 'CANCELLED') cancelled.push(booking);
      else if (status === 'COMPLETED') completed.push(booking);
      else upcoming.push(booking);
    });
    return { upcoming, completed, cancelled };
  }, [bookings]);

  // ── search filter
  const debouncedQ = useDebouncedValue(query, 300);
  const activeBookings = {
    upcoming: grouped.upcoming,
    completed: grouped.completed,
    cancelled: grouped.cancelled,
  }[activeTab] || [];

  const filtered = useMemo(() => {
    if (!debouncedQ) return activeBookings;
    const q = debouncedQ.toLowerCase();
    return activeBookings.filter((b) => {
      const mentor = b?.session?.mentor?.fullName || '';
      const title = b?.session?.title || '';
      const date = formatDate(b?.session?.startTime);
      const status = b?.bookingStatus || '';
      return `${mentor} ${title} ${date} ${status}`.toLowerCase().includes(q);
    });
  }, [activeBookings, debouncedQ]);

  // ── upcoming reminder (within 24 h)
  const imminent = useMemo(() => grouped.upcoming.find((b) => {
    const start = new Date(b?.session?.startTime || 0).getTime();
    const diff = start - Date.now();
    return diff > 0 && diff < 24 * 3600 * 1000;
  }), [grouped.upcoming]);

  // ── total learning hours
  const totalHours = useMemo(() => {
    const h = grouped.completed.reduce((sum, b) => {
      const s = new Date(b?.session?.startTime || 0).getTime();
      const e = new Date(b?.session?.endTime || 0).getTime();
      return e > s ? sum + (e - s) / 3600000 : sum;
    }, 0);
    return Math.round(h * 10) / 10;
  }, [grouped.completed]);

  // ── calendar grouping by date
  const calendarGroups = useMemo(() => {
    const map = new Map();
    filtered.forEach((b) => {
      const d = formatDate(b?.session?.startTime);
      if (!map.has(d)) map.set(d, []);
      map.get(d).push(b);
    });
    return [...map.entries()];
  }, [filtered]);

  return (
    <div className="lp-shell md">
      {/* ── Reminder banner ── */}
      {imminent && (
        <div className="lp-reminder-banner md-animate">
          <div className="lp-reminder-banner__icon"><Icon name="notifications_active" /></div>
          <div className="lp-reminder-banner__text">
            <p className="lp-reminder-banner__title">Session starting soon!</p>
            <p className="lp-reminder-banner__sub">
              <strong>{imminent?.session?.title || 'Your session'}</strong> with <strong>{imminent?.session?.mentor?.fullName || 'your mentor'}</strong> begins at {formatDateTime(imminent?.session?.startTime)}.
            </p>
          </div>
          {imminent?.session?.meetingLink && (
            <a href={imminent.session.meetingLink} target="_blank" rel="noreferrer" className="md-btn md-btn--brand md-btn--sm">
              <Icon name="videocam" /> Join Now
            </a>
          )}
        </div>
      )}

      {/* ── Hero ── */}
      <div className="lp-hero md-animate">
        <div className="lp-hero__eyebrow"><Icon name="calendar_month" /> Session Manager</div>
        <h1>Your Booked Sessions</h1>
        <p className="lp-hero__sub">
          Manage upcoming, completed and cancelled sessions in one place. Join, reschedule or review any session.
        </p>
        <div className="lp-hero__actions">
          <label className="lp-hero__search">
            <Icon name="search" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by mentor, title, date, status…"
              id="session-search-input"
            />
            {query && (
              <button type="button" className="lp-hero__search-clear" onClick={() => setQuery('')} aria-label="Clear search">
                <Icon name="close" />
              </button>
            )}
          </label>
          <div className="lp-view-toggle">
            <button type="button" className={`lp-view-btn${viewMode === 'list' ? ' is-active' : ''}`} onClick={() => setViewMode('list')} title="List view">
              <Icon name="view_list" />
            </button>
            <button type="button" className={`lp-view-btn${viewMode === 'calendar' ? ' is-active' : ''}`} onClick={() => setViewMode('calendar')} title="Calendar view">
              <Icon name="calendar_view_month" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="lp-sessions-stats md-animate">
        <StatsCard icon="event" label="Upcoming" value={grouped.upcoming.length} description="Future sessions" />
        <StatsCard icon="task_alt" label="Completed" value={grouped.completed.length} description="Finished sessions" />
        <StatsCard icon="cancel" label="Cancelled" value={grouped.cancelled.length} description="Stopped bookings" />
        <StatsCard icon="schedule" label="Total Hours" value={`${totalHours}h`} description="Learning time" />
      </div>

      {/* ── Tabs ── */}
      <div className="lp-toolbar--premium">
        <div className="lp-tabs-nav">
          {[
            { key: 'upcoming', label: 'Upcoming', icon: 'event', count: grouped.upcoming.length },
            { key: 'completed', label: 'Completed', icon: 'task_alt', count: grouped.completed.length },
            { key: 'cancelled', label: 'Cancelled', icon: 'cancel', count: grouped.cancelled.length },
          ].map((tab) => (
            <button key={tab.key} type="button"
              className={`lp-tab-btn${activeTab === tab.key ? ' is-active' : ''}`}
              onClick={() => { setActiveTab(tab.key); setQuery(''); }}
            >
              <Icon name={tab.icon} />{tab.label}
              <span className="lp-tab-count">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Session list / calendar ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1,2,3].map((k) => <SessionSkeletonCard key={k} />)}
        </div>
      ) : error ? (
        <ErrorBlock title="Sessions could not be loaded" error={error} onRetry={() => setRefreshKey((v) => v + 1)} />
      ) : filtered.length === 0 ? (
        <div className="lp-empty--premium">
          <div className="lp-empty__icon-wrap">
            <Icon name={activeTab === 'upcoming' ? 'event_busy' : activeTab === 'completed' ? 'task_alt' : 'cancel'} />
          </div>
          <p className="lp-empty__title">
            {debouncedQ ? `No ${activeTab} sessions match "${debouncedQ}"` : `No ${activeTab} sessions`}
          </p>
          <p className="lp-empty__desc">
            {activeTab === 'upcoming'
              ? 'Book a session with a mentor to get started on your learning journey.'
              : activeTab === 'completed'
              ? 'Completed sessions will appear here once they are finished.'
              : 'Cancelled sessions will appear here if any bookings are cancelled.'}
          </p>
          {activeTab === 'upcoming' && (
            <Link to="/learner/mentors" className="md-btn md-btn--brand md-btn--sm">
              <Icon name="person_search" /> Find Mentors
            </Link>
          )}
          {debouncedQ && (
            <button type="button" className="md-btn md-btn--outline md-btn--sm" onClick={() => setQuery('')}>Clear search</button>
          )}
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="lp-calendar-view md-animate">
          {calendarGroups.map(([date, dayBookings]) => (
            <div key={date} className="lp-cal-day-group">
              <div className="lp-cal-day-label">
                <span className="lp-cal-day-label__dot" />
                <span className="lp-cal-day-label__text">{date}</span>
                <span className="lp-cal-day-label__line" />
                <span style={{ fontSize: '0.78rem', color: 'var(--md-muted)', whiteSpace: 'nowrap' }}>{dayBookings.length} session{dayBookings.length !== 1 ? 's' : ''}</span>
              </div>
              <div className="lp-cal-sessions">
                {dayBookings.map((b) => <PremiumSessionCard key={b.id} booking={b} />)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="md-animate">
          {filtered.map((b) => <PremiumSessionCard key={b.id} booking={b} />)}
        </div>
      )}
    </div>
  );
}

export function LearnerCertificatesPage() {
  useDocumentTitle("Certificates");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useResource(
    () => apiGet("/api/v1/certifications/me"),
    [refreshKey],
  );
  const certificates = data || [];

  async function refreshCertificates() {
    try {
      await apiPost("/api/v1/certifications/evaluate");
      setRefreshKey((value) => value + 1);
    } catch (refreshError) {
      window.console.error(refreshError);
    }
  }

  if (loading) return <LoadingBlock title="Loading certificates" />;
  if (error)
    return (
      <ErrorBlock
        title="Certificates could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  return (
    <div className="lp-shell">
      <PageHeader
        title="Certificates"
        subtitle="Certificates issued by the backend certification service."
        actions={
          <button
            type="button"
            className="md-btn md-btn--brand md-btn--sm"
            onClick={refreshCertificates}
          >
            Re-evaluate
          </button>
        }
      />
      <div className="ld-stats md-animate">
        <StatsCard
          icon="workspace_premium"
          label="Certificates"
          value={certificates.length}
          description="Issued on your account"
        />
        <StatsCard
          icon="verified"
          label="Ready"
          value={certificates.length ? "Yes" : "No"}
          description="Backend evaluation status"
        />
        <StatsCard
          icon="calendar_month"
          label="Latest"
          value={certificates[0] ? formatDate(certificates[0].issuedAt) : "TBD"}
          description="Most recent issuance"
        />
        <StatsCard
          icon="badge"
          label="Codes"
          value={certificates[0]?.code ? 1 : 0}
          description="Certificate codes present"
        />
      </div>
      <SectionCard title="Certificate gallery" icon="workspace_premium">
        {certificates.length ? (
          <div className="lp-grid lp-grid--certificates">
            {certificates.map((certificate) => (
              <CertificateCard key={certificate.id} certificate={certificate} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="workspace_premium"
            title="No certificates yet"
            description="Use the backend evaluation endpoint to generate certificates when eligible."
          />
        )}
      </SectionCard>
    </div>
  );
}

export function LearnerMessagesPage() {
  useDocumentTitle("Messages");
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [draft, setDraft] = useState("");

  const conversationsState = useMessagesData(refreshKey);
  const conversations = conversationsState.data?.conversations || [];

  useEffect(() => {
    if (!selectedBookingId && conversations.length) {
      setSelectedBookingId(conversations[0].bookingId);
    }
  }, [conversations, selectedBookingId]);

  useEffect(() => {
    if (!selectedBookingId) {
      return undefined;
    }
    apiPut(`/api/v1/chat/booking/${selectedBookingId}/read`).catch(
      () => undefined,
    );
    return undefined;
  }, [selectedBookingId]);

  const threadState = useResource(
    () =>
      selectedBookingId
        ? apiGet(`/api/v1/chat/booking/${selectedBookingId}`)
        : Promise.resolve([]),
    [selectedBookingId, refreshKey],
  );
  const selectedConversation =
    conversations.find(
      (conversation) => conversation.bookingId === selectedBookingId,
    ) || null;
  const threadMessages = threadState.data || [];

  async function sendMessage(event) {
    event.preventDefault();
    if (!selectedBookingId || !draft.trim()) {
      return;
    }
    try {
      await apiPost(`/api/v1/chat/booking/${selectedBookingId}`, {
        content: draft,
      });
      setDraft("");
      setRefreshKey((value) => value + 1);
    } catch (sendError) {
      window.console.error(sendError);
    }
  }

  if (conversationsState.loading)
    return <LoadingBlock title="Loading messages" />;
  if (conversationsState.error)
    return (
      <ErrorBlock
        title="Messages could not be loaded"
        error={conversationsState.error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  return (
    <div className="lp-shell">
      <PageHeader
        title="Messages"
        subtitle="Live conversation threads loaded from the backend chat service."
      />
      <div className="lp-messages">
        <SectionCard
          title="Conversations"
          icon="chat"
          className="lp-messages__list"
        >
          {conversations.length ? (
            <div className="lp-message-list">
              {conversations.map((conversation) => (
                <button
                  key={conversation.bookingId}
                  type="button"
                  className={`lp-message-item${conversation.bookingId === selectedBookingId ? " is-active" : ""}`}
                  onClick={() => setSelectedBookingId(conversation.bookingId)}
                >
                  <div className="lp-message-item__avatar">
                    {initials(conversation.participantName)}
                  </div>
                  <div>
                    <strong>{conversation.participantName}</strong>
                    <p>{conversation.sessionTitle}</p>
                    <small>{conversation.lastMessagePreview}</small>
                  </div>
                  <span className="md-badge md-badge--info">
                    {conversation.unreadCount}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="chat_bubble_outline"
              title="No conversations yet"
              description="Booked sessions will open a chat thread automatically."
              actionLabel="Find mentors"
              actionTo="/learner/mentors"
            />
          )}
        </SectionCard>

        <SectionCard
          title={selectedConversation?.participantName || "Conversation"}
          icon="forum"
          className="lp-messages__thread"
        >
          {selectedConversation ? (
            <>
              <div className="lp-thread__meta">
                <div>
                  <strong>{selectedConversation.sessionTitle}</strong>
                  <p>{selectedConversation.participantPresenceText}</p>
                </div>
                <Link
                  to="/learner/sessions"
                  className="md-btn md-btn--outline md-btn--sm"
                >
                  View booking
                </Link>
              </div>

              <div className="lp-thread">
                {threadMessages.length ? (
                  threadMessages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      fromMe={
                        String(message.senderRole).toUpperCase() === "LEARNER"
                      }
                    />
                  ))
                ) : (
                  <EmptyState
                    icon="chat"
                    title="No messages in this thread"
                    description="Send the first message from the composer below."
                  />
                )}
              </div>

              <form className="lp-thread__composer" onSubmit={sendMessage}>
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Write a message to your mentor..."
                  rows={3}
                />
                <button
                  type="submit"
                  className="md-btn md-btn--brand md-btn--sm"
                >
                  Send message
                </button>
              </form>
            </>
          ) : (
            <EmptyState
              icon="forum"
              title="Select a conversation"
              description="Pick a chat from the left panel to view the thread."
            />
          )}
        </SectionCard>
      </div>
    </div>
  );
}

export function LearnerNotificationsPage() {
  useDocumentTitle("Notifications");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useNotificationsData(refreshKey);
  const notifications = data?.notifications || [];
  const preferences = data?.preferences || null;

  async function markNotification(notification) {
    try {
      await apiPut(`/api/v1/notifications/${notification.id}/read`);
      setRefreshKey((value) => value + 1);
    } catch (markError) {
      window.console.error(markError);
    }
  }

  async function markAllRead() {
    try {
      await apiPut("/api/v1/notifications/mark-all-read");
      setRefreshKey((value) => value + 1);
    } catch (markError) {
      window.console.error(markError);
    }
  }

  if (loading) return <LoadingBlock title="Loading notifications" />;
  if (error)
    return (
      <ErrorBlock
        title="Notifications could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  return (
    <div className="lp-shell">
      <PageHeader
        title="Notifications"
        subtitle="Real notification records, read status, and backend preferences."
        actions={
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            onClick={markAllRead}
          >
            Mark all read
          </button>
        }
      />
      <div className="ld-stats md-animate">
        <StatsCard
          icon="notifications"
          label="Notifications"
          value={notifications.length}
          description="Loaded from backend"
        />
        <StatsCard
          icon="mark_email_read"
          label="Unread"
          value={notifications.filter((item) => !item.read).length}
          description="Still waiting"
        />
        <StatsCard
          icon="settings"
          label="Preferences"
          value={preferences ? "Ready" : "Unavailable"}
          description="Notification profile"
        />
        <StatsCard
          icon="event_available"
          label="Types"
          value={new Set(notifications.map((item) => item.type)).size}
          description="Unique notification types"
        />
      </div>
      <SectionCard title="Notification feed" icon="notifications">
        {notifications.length ? (
          <div className="lp-detail-stack">
            {notifications.map((notification) => (
              <NotificationRow
                key={notification.id}
                item={notification}
                onToggle={() => markNotification(notification)}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="notifications_off"
            title="No notifications yet"
            description="Backend notifications will appear here when events are created."
          />
        )}
      </SectionCard>
      <SectionCard title="Preferences" icon="tune">
        {preferences ? (
          <div className="lp-detail-stack">
            <div>
              <span>Email alerts</span>
              <strong>
                {preferences.emailEnabled ? "Enabled" : "Disabled"}
              </strong>
            </div>
            <div>
              <span>Booking updates</span>
              <strong>
                {preferences.bookingUpdates ? "Enabled" : "Disabled"}
              </strong>
            </div>
            <div>
              <span>Session announcements</span>
              <strong>
                {preferences.sessionAnnouncements ? "Enabled" : "Disabled"}
              </strong>
            </div>
            <div>
              <span>Review alerts</span>
              <strong>
                {preferences.reviewAlerts ? "Enabled" : "Disabled"}
              </strong>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="tune"
            title="No preferences loaded"
            description="Notification preferences are read directly from the backend."
          />
        )}
      </SectionCard>
    </div>
  );
}

export function LearnerProfilePage() {
  useDocumentTitle("Profile");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  if (loading) return <LoadingBlock title="Loading profile" />;
  if (error)
    return (
      <ErrorBlock
        title="Profile could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  const {
    profile,
    referral,
    certifications,
    roadmaps,
    savedMentors,
    savedSkills,
  } = data;

  return (
    <div className="lp-shell">
      <PageHeader
        title="Profile"
        subtitle="Your live learner profile, referral data, and saved backend records."
      />
      <div className="ld-stats md-animate">
        <StatsCard
          icon="person"
          label="Completion"
          value={`${profile?.profileCompletionPercent || 0}%`}
          description="From backend profile data"
        />
        <StatsCard
          icon="bookmark"
          label="Saved mentors"
          value={savedMentors.length}
          description="Mentor bookmarks"
        />
        <StatsCard
          icon="school"
          label="Saved skills"
          value={savedSkills.length}
          description="Skill watchlist"
        />
        <StatsCard
          icon="workspace_premium"
          label="Certificates"
          value={certifications.length}
          description="Issued certificates"
        />
      </div>
      <div className="ld-row md-animate">
        <div className="ld-c8">
          <DetailCard title="Account details" icon="badge">
            <div className="lp-detail-stack">
              <div>
                <span>Name</span>
                <strong>{profile?.fullName || "Learner"}</strong>
              </div>
              <div>
                <span>Email</span>
                <strong>{profile?.email || "Unavailable"}</strong>
              </div>
              <div>
                <span>Skills</span>
                <strong>
                  {splitSkills(profile?.skills).join(", ") || "No skills added"}
                </strong>
              </div>
              <div>
                <span>About</span>
                <strong>
                  {profile?.aboutMe || "No about section provided"}
                </strong>
              </div>
            </div>
          </DetailCard>
        </div>
        <div className="ld-c4">
          <DetailCard title="Referral" icon="share">
            <div className="lp-detail-stack">
              <div>
                <span>Code</span>
                <strong>
                  {referral?.referralCode ||
                    profile?.referralCode ||
                    "Unavailable"}
                </strong>
              </div>
              <div>
                <span>Referrals</span>
                <strong>{referral?.totalReferrals ?? 0}</strong>
              </div>
              <div>
                <span>Credits</span>
                <strong>{referral?.totalCreditsEarned ?? 0}</strong>
              </div>
            </div>
          </DetailCard>
        </div>
      </div>
      <SectionCard title="Learning progress" icon="timeline">
        <div className="lp-detail-stack">
          {roadmaps.length ? (
            roadmaps.map((roadmap) => (
              <div key={roadmap.id}>
                <strong>{roadmap.title}</strong>
                <ProgressBar
                  value={roadmap.progressPercent}
                  label={`${roadmap.progressPercent || 0}% complete`}
                />
              </div>
            ))
          ) : (
            <EmptyState
              icon="timeline"
              title="No roadmap data"
              description="A booked session will create a roadmap on the backend."
            />
          )}
        </div>
      </SectionCard>
      <SectionCard title="Certificates" icon="workspace_premium">
        {certifications.length ? (
          <div className="lp-grid lp-grid--certificates">
            {certifications.map((certificate) => (
              <CertificateCard key={certificate.id} certificate={certificate} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon="workspace_premium"
            title="No certificates yet"
            description="Your issued certificates will appear here."
          />
        )}
      </SectionCard>
    </div>
  );
}

export function LearnerSettingsPage() {
  useDocumentTitle("Settings");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useNotificationsData(refreshKey);

  if (loading) return <LoadingBlock title="Loading settings" />;
  if (error)
    return (
      <ErrorBlock
        title="Settings could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  const preferences = data?.preferences || null;

  async function savePreferences(event) {
    event.preventDefault();
    if (!preferences) return;
    try {
      await apiPut("/api/v1/notifications/preferences", preferences);
      setRefreshKey((value) => value + 1);
    } catch (saveError) {
      window.console.error(saveError);
    }
  }

  return (
    <div className="lp-shell">
      <PageHeader
        title="Settings"
        subtitle="Notification preferences and live backend account settings."
      />
      <SectionCard title="Notification preferences" icon="notifications">
        {preferences ? (
          <form className="lp-detail-stack" onSubmit={savePreferences}>
            {Object.entries(preferences).map(([key, value]) => (
              <label key={key} className="lp-setting-toggle">
                <span>{key}</span>
                <input type="checkbox" checked={Boolean(value)} readOnly />
              </label>
            ))}
            <button type="submit" className="md-btn md-btn--brand md-btn--sm">
              Save preferences
            </button>
          </form>
        ) : (
          <EmptyState
            icon="notifications"
            title="No preferences found"
            description="Notification preferences are not available for this account."
          />
        )}
      </SectionCard>
    </div>
  );
}

export function LearnerPathPage() {
  useDocumentTitle("Learning Path");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  if (loading) return <LoadingBlock title="Loading learning path" />;
  if (error)
    return (
      <ErrorBlock
        title="Learning path could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  return (
    <LearningSummary
      data={data}
      onRefresh={() => setRefreshKey((value) => value + 1)}
    />
  );
}

export function LearnerAchievementsPage() {
  useDocumentTitle("Achievements");
  const [refreshKey, setRefreshKey] = useState(0);
  const { loading, data, error } = useLearnerLearningData(refreshKey);

  if (loading) return <LoadingBlock title="Loading achievements" />;
  if (error)
    return (
      <ErrorBlock
        title="Achievements could not be loaded"
        error={error}
        onRetry={() => setRefreshKey((value) => value + 1)}
      />
    );

  const {
    certifications,
    roadmaps,
    savedMentors,
    savedSkills,
    bookings,
    profile,
  } = data;
  const completedBookings = bookings.filter(
    (booking) =>
      String(booking?.bookingStatus || "").toUpperCase() === "COMPLETED",
  );
  const totalProgress = roadmaps.reduce(
    (sum, roadmap) => sum + Number(roadmap.progressPercent || 0),
    0,
  );

  const items = [
    {
      title: "Completed sessions",
      detail: `${completedBookings.length} completed bookings`,
      icon: "task_alt",
    },
    {
      title: "Certificates",
      detail: `${certifications.length} issued certificates`,
      icon: "workspace_premium",
    },
    {
      title: "Saved mentors",
      detail: `${savedMentors.length} mentors saved in watchlist`,
      icon: "bookmark",
    },
    {
      title: "Saved skills",
      detail: `${savedSkills.length} skills added to watchlist`,
      icon: "school",
    },
    {
      title: "Profile completion",
      detail: `${profile?.profileCompletionPercent || 0}% complete`,
      icon: "person",
    },
    {
      title: "Roadmap progress",
      detail: `${roadmaps.length ? Math.round(totalProgress / roadmaps.length) : 0}% average progress`,
      icon: "route",
    },
  ];

  return (
    <div className="lp-shell">
      <PageHeader
        title="Achievements"
        subtitle="All visible achievements are derived from backend records and live learner activity."
      />
      <div className="ld-stats md-animate">
        <StatsCard
          icon="workspace_premium"
          label="Certificates"
          value={certifications.length}
          description="Backend issued"
        />
        <StatsCard
          icon="bookmark"
          label="Saved mentors"
          value={savedMentors.length}
          description="Mentor watchlist"
        />
        <StatsCard
          icon="school"
          label="Saved skills"
          value={savedSkills.length}
          description="Skill watchlist"
        />
        <StatsCard
          icon="task_alt"
          label="Completed"
          value={completedBookings.length}
          description="Closed sessions"
        />
      </div>
      <SectionCard title="Achievement list" icon="military_tech">
        <div className="lp-achievement-list">
          {items.map((item) => (
            <div key={item.title} className="lp-achievement">
              <Icon name={item.icon} />
              <div>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
