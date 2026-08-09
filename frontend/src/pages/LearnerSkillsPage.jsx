import { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import { normalizeSkills } from "../utils/skills";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

/* ───────────── constants ───────────── */
const EMPTY_ARRAY = [];

/* Skills and mentor metrics are served live from the backend — no hardcoded
   featured lists or invented learner/mentor counts are used here anymore. */

function resourceUrl(skillName, label) {
  const name = (skillName || "").toLowerCase();
  const enc = encodeURIComponent(name);
  const docs = {
    java: "https://docs.oracle.com/en/java/",
    react: "https://react.dev/",
    "spring boot": "https://spring.io/projects/spring-boot",
    python: "https://docs.python.org/3/",
    "node.js": "https://nodejs.org/docs/latest/api/",
    aws: "https://docs.aws.amazon.com/",
    docker: "https://docs.docker.com/",
    sql: "https://www.w3schools.com/sql/",
  };
  if (label === "Official Documentation" && docs[name]) return docs[name];
  if (label === "YouTube Playlists") return `https://www.youtube.com/results?search_query=${enc}+course`;
  if (label === "Practice Questions") return "https://leetcode.com/problemset/";
  if (label === "Mini Projects" || label === "GitHub Repositories") return `https://github.com/topics/${enc}`;
  if (label === "Interview Preparation") return `https://www.geeksforgeeks.org/${enc}-interview-questions/`;
  return `https://www.google.com/search?q=${encodeURIComponent(skillName + " " + label)}`;
}

const RESOURCES_DATA = [
  { title: "Official Documentation", icon: "menu_book", desc: "Comprehensive docs from the official sources", color: "#0F9D8A" },
  { title: "YouTube Playlists", icon: "play_circle", desc: "Curated video tutorials and walkthroughs", color: "#EF4444" },
  { title: "Practice Questions", icon: "quiz", desc: "Coding challenges and interview prep problems", color: "#8B5CF6" },
  { title: "Mini Projects", icon: "code", desc: "Hands-on projects to build your portfolio", color: "#F59E0B" },
  { title: "GitHub Repositories", icon: "inventory_2", desc: "Open-source codebases and example projects", color: "#1F2937" },
  { title: "Interview Preparation", icon: "work_history", desc: "Common interview questions and strategies", color: "#EC4899" },
];

/* ───────────── helpers ───────────── */

function slugify(name) {
  return String(name || "").toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
}

function toTitle(str) {
  if (!str) return "";
  return String(str).replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(val) {
  return String(val || "?")
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getErrorMessage(error) {
  return error?.response?.data?.message || error?.response?.data?.error || error?.message || "Unable to load data";
}

function unwrap(payload) {
  if (payload && typeof payload === "object" && "data" in payload && "message" in payload) return payload.data;
  return payload;
}

async function apiGet(path, cfg) {
  const r = await client.get(path, cfg);
  return unwrap(r.data);
}

function useDocTitle(title) {
  useEffect(() => { document.title = `${title} | SkillSwap`; }, [title]);
}

function useDebounced(val, delay = 300) {
  const [d, setD] = useState(val);
  useEffect(() => {
    const t = window.setTimeout(() => setD(val), delay);
    return () => window.clearTimeout(t);
  }, [delay, val]);
  return d;
}

/* ───────────── color helpers ───────────── */

const GRADIENTS = [
  "linear-gradient(135deg,#0f766e,#14b8a6)",
  "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  "linear-gradient(135deg,#7c3aed,#a78bfa)",
  "linear-gradient(135deg,#b45309,#f59e0b)",
  "linear-gradient(135deg,#be123c,#f43f5e)",
  "linear-gradient(135deg,#0369a1,#38bdf8)",
  "linear-gradient(135deg,#065f46,#34d399)",
  "linear-gradient(135deg,#6b21a8,#d946ef)",
];

function pickGradient(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

function pickIcon(category) {
  const map = {
    programming: "code", frontend: "web", backend: "dns", cloud: "cloud",
    ai: "psychology", devops: "terminal", "cyber security": "security",
    "data science": "analytics", mobile: "smartphone", blockchain: "token",
    database: "storage", "ui/ux": "design_services", "system design": "account_tree",
  };
  return map[(category || "").toLowerCase()] || "auto_stories";
}

function skillDifficulty(skill) {
  const raw = skill?.difficulty || skill?.level || "";
  return raw ? raw.toLowerCase() : "";
}

function difficultyMeta(d) {
  const map = {
    beginner: { label: "Beginner", icon: "signal_cellular_0_bar", color: "#16A34A", bg: "rgba(22,163,74,0.10)" },
    intermediate: { label: "Intermediate", icon: "signal_cellular_2_bar", color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
    advanced: { label: "Advanced", icon: "signal_cellular_4_bar", color: "#EF4444", bg: "rgba(239,68,68,0.10)" },
  };
  return map[d] || map.beginner;
}

function estimatedTime(skill) {
  const map = { beginner: "4–8 weeks", intermediate: "8–16 weeks", advanced: "12–24 weeks" };
  const d = skillDifficulty(skill);
  return d ? map[d] || "4–8 weeks" : "";
}

/* ───────────── sub-components ───────────── */

function SkillSkeleton() {
  return (
    <div className="sk-skill-card">
      <div className="sk-hdr" />
      <div className="sk-body">
        <div className="sk-line sk-line--60" />
        <div className="sk-line sk-line--40" />
        <div className="sk-meta-grid">{ [1,2,3,4].map((i) => <div key={i} className="sk-meta" />) }</div>
        <div className="sk-btn-row"><div className="sk-btn" /><div className="sk-btn" /></div>
      </div>
    </div>
  );
}

function SkillCard({ skill }) {
  const navigate = useNavigate();
  const cat = skill.category || "General";
  const hasDifficulty = Boolean(skillDifficulty(skill));
  const diffMeta = difficultyMeta(skillDifficulty(skill));
  const time = estimatedTime(skill);
  const slug = slugify(skill.name);
  const openSkill = () => navigate(`/learner/skills/${slug}`);
  // The card is a clickable div (not an <a>) so the inner action links never
  // nest an anchor inside an anchor — invalid HTML that React warns about and
  // browsers handle inconsistently.
  return (
    <div
      className="sk-card md-animate"
      role="link"
      tabIndex={0}
      aria-label={`Open ${skill.name} details`}
      onClick={openSkill}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openSkill();
        }
      }}
      style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", cursor: "pointer" }}
    >
      <div className="sk-card__hdr" style={{ background: pickGradient(skill.name || cat) }}>
        <Icon name={pickIcon(cat)} />
      </div>
      <div className="sk-card__body">
        <div className="sk-card__top">
          <h3 className="sk-card__title">{skill.name}</h3>
          <span className="sk-card__cat">{cat}</span>
        </div>
        <p className="sk-card__desc">{skill.description?.slice(0, 100) || ""}{skill.description?.length > 100 ? "…" : ""}</p>
        {/* Difficulty/time badges render only when the API actually provides them */}
        {hasDifficulty && (
          <div className="sk-card__badges">
            <span className="sk-card__diff" style={{ background: diffMeta.bg, color: diffMeta.color }}>
              <Icon name={diffMeta.icon} /> {diffMeta.label}
            </span>
            {time && <span className="sk-card__time"><Icon name="schedule" /> {time}</span>}
          </div>
        )}
        {/* Metrics render only when the API actually provides them — no invented numbers */}
        {(skill.learners != null || skill.mentors != null || skill.rating != null) && (
          <div className="sk-card__meta">
            {skill.learners != null && (
              <div className="sk-card__mi"><Icon name="people" /><strong>{(skill.learners || 0).toLocaleString()}</strong><span>learners</span></div>
            )}
            {skill.mentors != null && (
              <div className="sk-card__mi"><Icon name="person" /><strong>{skill.mentors || 0}</strong><span>mentors</span></div>
            )}
            {skill.rating > 0 && (
              <div className="sk-card__mi"><Icon name="star" /><strong>{Number(skill.rating).toFixed(1)}</strong><span>rating</span></div>
            )}
          </div>
        )}
        <div className="sk-card__actions">
          <Link to={`/learner/skills/${slug}`} className="sk-card__roadmap-link" onClick={(e) => e.stopPropagation()}>
            <Icon name="auto_stories" /> Explore Skill
          </Link>
          <Link to={`/learner/mentors?skill=${encodeURIComponent(skill.name)}`} className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn" onClick={(e) => e.stopPropagation()}>
            <Icon name="person_search" /> Find Mentor
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ resource, skillName }) {
  const url = resourceUrl(skillName, resource.title);
  const openResource = () => window.open(url, "_blank", "noopener,noreferrer");
  return (
    <div className="sk-resource-card--catalog md-animate">
      <div
        role="link"
        tabIndex={0}
        aria-label={`Open ${resource.title}`}
        onClick={openResource}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openResource();
          }
        }}
        style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 10, flex: 1, cursor: "pointer" }}
      >
        <div className="sk-resource-card--catalog__icon" style={{ background: resource.color }}>
          <Icon name={resource.icon} />
        </div>
        <h4 className="sk-resource-card--catalog__title">{resource.title}</h4>
        <p className="sk-resource-card--catalog__desc">{resource.desc}</p>
      </div>
      <div className="sk-resource-card--catalog__actions">
        <a href={url} target="_blank" rel="noopener noreferrer" className="sk-card__roadmap-link" onClick={(e) => e.stopPropagation()}>
          <Icon name="open_in_new" /> Open Resource
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn" style={{ textDecoration: "none" }} onClick={(e) => e.stopPropagation()}>
          <Icon name="launch" /> Open
        </a>
      </div>
    </div>
  );
}

function MentorMiniCard({ mentor }) {
  return (
    <div className="sk-mentor--catalog md-animate">
      <div className="sk-mentor--catalog__avatar">
        {mentor.profileImageUrl ? (
          <img src={mentor.profileImageUrl} alt={mentor.fullName} />
        ) : (
          <span>{initials(mentor.fullName)}</span>
        )}
      </div>
      <div className="sk-mentor--catalog__body">
        <strong className="sk-mentor--catalog__name">{mentor.fullName}</strong>
        {mentor.company && <span className="sk-mentor--catalog__company">{mentor.company}</span>}
        <div className="sk-mentor--catalog__rating">
          <Icon name="star" />
          <span>{mentor.averageRating > 0 ? mentor.averageRating.toFixed(1) : "—"}</span>
          {mentor.totalReviews > 0 ? (
            <span className="sk-mentor--catalog__sessions">{mentor.totalReviews} review{mentor.totalReviews !== 1 ? "s" : ""}</span>
          ) : mentor.totalSessions > 0 ? (
            <span className="sk-mentor--catalog__sessions">{mentor.totalSessions} sessions</span>
          ) : null}
        </div>
        {(() => {
          const chips = normalizeSkills(mentor.skills);
          return chips.length > 0 ? (
            <div className="sk-mentor--catalog__skills">
              {chips.slice(0, 2).map((s) => <span key={s}>{s}</span>)}
            </div>
          ) : null;
        })()}
      </div>
      <div className="sk-mentor--catalog__actions">
        <Link to={`/mentors/${mentor.id}`} className="sk-card__roadmap-link">
          <Icon name="person" /> View Profile
        </Link>
        <Link to={`/mentors/${mentor.id}`} className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn">
          <Icon name="calendar_month" /> Book Session
        </Link>
      </div>
    </div>
  );
}

/* ───────────── MAIN ───────────── */

export default function LearnerSkillsPage() {
  useDocTitle("Explore Skills");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("popular");
  const [difficulty, setDifficulty] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const debouncedQuery = useDebounced(query, 350);

  // ── data fetch (live API data only — no hardcoded fallbacks) ──
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const [skills, mentors] = await Promise.all([
          apiGet("/api/v1/skills", { params: debouncedQuery ? { q: debouncedQuery } : undefined }),
          apiGet("/api/v1/users/mentors").catch(() => []),
        ]);
        if (!active) return;
        setState({
          loading: false,
          data: {
            skills: skills || EMPTY_ARRAY,
            mentors: mentors || EMPTY_ARRAY,
          },
          error: null,
        });
      } catch (err) {
        if (!active) return;
        setState({ loading: false, data: null, error: getErrorMessage(err) });
      }
    })();

    return () => { active = false; };
  }, [debouncedQuery, refreshKey]);

  const { loading, data, error } = state;
  const skills = data?.skills || EMPTY_ARRAY;
  const mentors = data?.mentors || EMPTY_ARRAY;

  // ── filtered / sorted skills ──
  const filtered = useMemo(() => {
    let list = skills;
    if (category) {
      list = list.filter((s) => (s.category || "").toLowerCase() === category.toLowerCase());
    }
    if (difficulty) {
      list = list.filter((s) => skillDifficulty(s) === difficulty.toLowerCase());
    }
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter((s) => (s.name || "").toLowerCase().includes(q) || (s.category || "").toLowerCase().includes(q));
    }
    if (sortBy === "popular") list = [...list].sort((a, b) => (b.learners || b.mentorCount || 0) - (a.learners || a.mentorCount || 0));
    else if (sortBy === "name") list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [skills, category, difficulty, debouncedQuery, sortBy]);

  const hasActiveFilters = Boolean(debouncedQuery || category || difficulty);

  // ── top mentors (filtered by search query if active) ──
  const topMentors = useMemo(() => {
    let list = mentors;
    if (debouncedQuery) {
      const q = debouncedQuery.toLowerCase();
      list = list.filter((m) => {
        const skills = normalizeSkills(m.skills);
        return skills.some((s) => s.toLowerCase().includes(q));
      });
    }
    return list.slice(0, 3).map((m) => ({
      id: m.id || m.mentorId,
      fullName: m.fullName || m.mentorName || "Mentor",
      company: m.company || m.currentCompany || "",
      skills: normalizeSkills(m.skills),
      profileImageUrl: m.profileImageUrl,
      averageRating: Number(m.averageRating || 0),
      totalReviews: Number(m.totalReviews || 0),
      totalSessions: Number(m.totalCompletedSessions || m.sessionsCompleted || m.totalSessions || 0),
    }));
  }, [mentors, debouncedQuery]);

  const hasAnyDifficulty = useMemo(() => skills.some((s) => Boolean(skillDifficulty(s))), [skills]);

  const categories = useMemo(() => {
    const seen = new Set();
    const results = [{ label: "All", icon: "apps", value: "" }];
    skills.forEach((s) => {
      const c = (s.category || "").trim();
      if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); results.push({ label: toTitle(c), icon: pickIcon(c), value: c }); }
    });
    return results;
  }, [skills]);

  /* ═══════ RENDER ═══════ */

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* ═══ 1. HERO ═══ */}
      <MentorPageHero
        compact
        eyebrow="SKILLS"
        icon="auto_stories"
        title="Explore Skills"
        sub="Discover in-demand technologies, learning paths, and mentors to accelerate your career."
      >
        <label className="sk-hero__search" style={{ flex: 1, minWidth: 220, background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.15)" }}>
          <Icon name="search" style={{ color: "rgba(255,255,255,0.60)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills, technologies or categories..."
            aria-label="Search skills"
            style={{ color: "#fff" }}
          />
          {query && (
            <button type="button" className="sk-hero__search-clr" onClick={() => setQuery("")} aria-label="Clear" style={{ color: "rgba(255,255,255,0.60)" }}>
              <Icon name="close" />
            </button>
          )}
        </label>
        <button
          type="button"
          className={`sk-btn sk-btn--filter${showFilters ? " is-active" : ""}`}
          onClick={() => setShowFilters((v) => !v)}
          style={{ background: showFilters ? "rgba(255,255,255,0.20)" : "rgba(255,255,255,0.08)", color: "#fff", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <Icon name="tune" /> Filter
        </button>
        <label className="sk-hero__select" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "var(--mp-radius)", padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <Icon name="sort" style={{ color: "rgba(255,255,255,0.60)", fontSize: 18 }} />
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: "0.82rem", outline: "none" }}>
            <option value="popular" style={{ color: "#111" }}>Most Popular</option>
            <option value="name" style={{ color: "#111" }}>Name A–Z</option>
          </select>
        </label>
        {hasAnyDifficulty && (
          <label className="sk-hero__select" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "var(--mp-radius)", padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Icon name="signal_cellular_alt" style={{ color: "rgba(255,255,255,0.60)", fontSize: 18 }} />
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: "0.82rem", outline: "none" }}>
              <option value="" style={{ color: "#111" }}>All Levels</option>
              <option value="beginner" style={{ color: "#111" }}>Beginner</option>
              <option value="intermediate" style={{ color: "#111" }}>Intermediate</option>
              <option value="advanced" style={{ color: "#111" }}>Advanced</option>
            </select>
          </label>
        )}
      </MentorPageHero>

      {/* ─── Filter Panel ─── */}
      {showFilters && (
        <div className="sk-filter-panel">
          <div className="sk-filter__group">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.filter((c) => c.value).map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </div>
          {hasAnyDifficulty && (
            <div className="sk-filter__group">
              <label>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          )}
          <div className="sk-filter__actions">
            <button type="button" className="sk-btn sk-btn--ghost sk-btn--sm" onClick={() => { setCategory(""); setDifficulty(""); setSortBy("popular"); }}>
              <Icon name="restart_alt" /> Reset
            </button>
            <button type="button" className="sk-btn sk-btn--primary sk-btn--sm" onClick={() => setShowFilters(false)}>
              <Icon name="check" /> Apply
            </button>
          </div>
        </div>
      )}

      {/* ─── Category Pills ─── */}
      <div className="sk-pills">
        {categories.map((c) => (
          <button key={c.value} type="button" className={`sk-pill${category === c.value ? " is-active" : ""}`} onClick={() => setCategory(c.value)}>
            <Icon name={c.icon} /> {c.label}
          </button>
        ))}
      </div>

      {/* ─── Difficulty Pills (hidden when no skill provides difficulty) ─── */}
      {hasAnyDifficulty && (
        <div className="sk-pills sk-pills--diff">
          {[
            { value: "", label: "All Levels", icon: "unfold_more" },
            { value: "beginner", label: "Beginner", icon: "signal_cellular_0_bar" },
            { value: "intermediate", label: "Intermediate", icon: "signal_cellular_2_bar" },
            { value: "advanced", label: "Advanced", icon: "signal_cellular_4_bar" },
          ].map((d) => (
            <button key={d.value} type="button" className={`sk-pill sk-pill--diff${difficulty === d.value ? " is-active" : ""}`} onClick={() => setDifficulty(d.value)}>
              <Icon name={d.icon} /> {d.label}
            </button>
          ))}
        </div>
      )}

      {/* ═══ 2. FEATURED SKILLS ═══ */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title">
            <Icon name="grid_view" />
            {category ? `${category} Skills` : debouncedQuery ? `Results for "${debouncedQuery}"` : "Featured Skills"}
          </h2>
          <span className="sk-section__count">{filtered.length} skill{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {error ? (
          <div className="md-empty" style={{ margin: "16px 0", padding: "32px 20px", gap: 8 }}>
            <div className="md-empty__icon"><span className="material-symbols-outlined">cloud_off</span></div>
            <h3 className="md-empty__title">Skills could not be loaded</h3>
            <p className="md-empty__desc">{error}</p>
            <button type="button" className="mp-btn mp-btn--primary" onClick={() => setRefreshKey((v) => v + 1)}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>refresh</span> Retry
            </button>
          </div>
        ) : loading ? (
          <div className="sk-grid">{Array.from({ length: 8 }).map((_, i) => <SkillSkeleton key={i} />)}</div>
        ) : filtered.length > 0 ? (
          <div className="sk-grid">
            {filtered.map((skill) => <SkillCard key={skill.id || skill.name} skill={skill} />)}
          </div>
        ) : hasActiveFilters ? (
          <div className="md-empty" style={{ margin: "16px 0", padding: "32px 20px", gap: 8 }}>
            <div className="md-empty__icon"><span className="material-symbols-outlined">search_off</span></div>
            <h3 className="md-empty__title">No matching skills found</h3>
            <p className="md-empty__desc">Try changing your search or filters.</p>
            <button type="button" className="mp-btn mp-btn--primary" onClick={() => { setQuery(""); setCategory(""); setDifficulty(""); }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>restart_alt</span> Reset Filters
            </button>
          </div>
        ) : (
          <div className="md-empty" style={{ margin: "16px 0", padding: "32px 20px", gap: 8 }}>
            <div className="md-empty__icon"><span className="material-symbols-outlined">auto_stories</span></div>
            <h3 className="md-empty__title">No skills available yet</h3>
            <p className="md-empty__desc">Skills added to the platform will appear here. Check back soon.</p>
          </div>
        )}
      </section>

      {/* ═══ REMOVED: Browse Categories — redundant since this is already Explore Skills ═══ */}

      {/* ═══ 3. LEARNING RESOURCES ═══ */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title"><Icon name="school" /> Learning Resources</h2>
          <span className="sk-section__count">{RESOURCES_DATA.length} resources</span>
        </div>
        <div className="sk-resources-grid--catalog">
          {RESOURCES_DATA.map((r) => <ResourceCard key={r.title} resource={r} skillName={debouncedQuery || skills[0]?.name || ""} />)}
        </div>
      </section>

      {/* ═══ 6. RECOMMENDED MENTORS (max 3) — live data only ═══ */}
      {!loading && !error && (
        <section>
          <div className="sk-section__head">
            <h2 className="sk-section__title"><Icon name="groups" /> Recommended Mentors</h2>
            <Link to="/learner/mentors" className="sk-section__link">Browse All <Icon name="arrow_forward" /></Link>
          </div>
          {topMentors.length > 0 ? (
            <>
              <div className="sk-mentor-grid--catalog">
                {topMentors.slice(0, 3).map((m) => <MentorMiniCard key={m.id} mentor={m} />)}
              </div>
              <div className="sk-mentor-footer">
                <p>Looking for more options? Browse our full mentor marketplace with detailed profiles, reviews, and direct booking.</p>
                <Link to="/learner/mentors" className="sk-btn sk-btn--primary">
                  <Icon name="person_search" /> View All Mentors
                </Link>
              </div>
            </>
          ) : (
            <div className="md-empty" style={{ margin: "16px 0", padding: "32px 20px", gap: 8 }}>
              <div className="md-empty__icon"><span className="material-symbols-outlined">person_off</span></div>
              <h3 className="md-empty__title">No mentors available yet</h3>
              <p className="md-empty__desc">Mentors who join the platform will appear here once verified.</p>
              <Link to="/learner/mentors" className="mp-btn mp-btn--primary" style={{ textDecoration: "none" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_search</span> Browse All Mentors
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
