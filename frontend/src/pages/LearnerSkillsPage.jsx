import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";

/* ───────────── helpers ───────────── */

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

function parseSkills(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((v) => parseSkills(v)).map((s) => s.trim()).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith("[") && text.endsWith("]")) {
    try {
      return JSON.parse(text).flatMap((v) => parseSkills(v?.name ?? v)).map((s) => s.trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return text.split(/[\n,;|]+/).map((p) => p.trim()).filter(Boolean);
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
async function apiPost(path, body, cfg) {
  const r = await client.post(path, body, cfg);
  return unwrap(r.data);
}
async function apiDelete(path, cfg) {
  const r = await client.delete(path, cfg);
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

const TECH_LOGOS = {
  react: { icon: "code", color: "#61dafb" },
  "spring boot": { icon: "dns", color: "#6db33f" },
  java: { icon: "code", color: "#ed8b00" },
  python: { icon: "code", color: "#3776ab" },
  "node.js": { icon: "dns", color: "#339933" },
  docker: { icon: "cloud", color: "#2496ed" },
  aws: { icon: "cloud", color: "#ff9900" },
  kubernetes: { icon: "cloud", color: "#326ce5" },
  mongodb: { icon: "storage", color: "#47a248" },
  sql: { icon: "storage", color: "#e38c00" },
  nextjs: { icon: "code", color: "#000" },
  flutter: { icon: "smartphone", color: "#02569b" },
  postgresql: { icon: "storage", color: "#336791" },
  mysql: { icon: "storage", color: "#4479a1" },
  typescript: { icon: "code", color: "#3178c6" },
  javascript: { icon: "code", color: "#f7df1e" },
};

function techMeta(name) {
  return TECH_LOGOS[(name || "").toLowerCase()] || { icon: "code", color: "#0f766e" };
}

/* ───────────── sub-components ───────────── */

function SkillSkeleton() {
  return (
    <div className="sk-skill-card">
      <div className="sk-hdr" />
      <div className="sk-body">
        <div className="sk-line sk-line--60" />
        <div className="sk-line sk-line--40" />
        <div className="sk-meta-grid">
          {[1, 2, 3, 4].map((i) => <div key={i} className="sk-meta" />)}
        </div>
        <div className="sk-btn-row">
          <div className="sk-btn" />
          <div className="sk-btn" />
        </div>
      </div>
    </div>
  );
}

function SkillCard({ skill, mentorCount, saved, onToggle }) {
  const cat = skill.category || "General";
  return (
    <article className="sk-card">
      <div className="sk-card__hdr" style={{ background: pickGradient(skill.name || cat) }}>
        <Icon name={pickIcon(cat)} />
        <button
          type="button"
          className={`sk-card__save${saved ? " is-saved" : ""}`}
          onClick={() => onToggle(skill.name)}
          aria-label={saved ? "Unsave" : "Save skill"}
        >
          <Icon name={saved ? "bookmark" : "bookmark_border"} />
        </button>
      </div>
      <div className="sk-card__body">
        <div className="sk-card__top">
          <h3 className="sk-card__title">{skill.name}</h3>
          <span className="sk-card__cat">{cat}</span>
        </div>
        {skill.description && (
          <p className="sk-card__desc">{skill.description.slice(0, 120)}{skill.description.length > 120 ? "…" : ""}</p>
        )}
        <div className="sk-card__meta">
          <div className="sk-card__mi">
            <Icon name="person" />
            <strong>{mentorCount}</strong>
            <span>mentors</span>
          </div>
          {skill.averageRating > 0 && (
            <div className="sk-card__mi">
              <Icon name="star" />
              <strong>{Number(skill.averageRating).toFixed(1)}</strong>
              <span>rating</span>
            </div>
          )}
        </div>
        <div className="sk-card__actions">
          <Link to="/learner/path" className="sk-btn sk-btn--outline sk-btn--sm">
            <Icon name="route" /> Roadmap
          </Link>
          <Link to="/learner/mentors" className="sk-btn sk-btn--primary sk-btn--sm">
            <Icon name="person_search" /> Mentor
          </Link>
        </div>
      </div>
    </article>
  );
}

function MentorMiniCard({ mentor }) {
  return (
    <Link to={`/mentors/${mentor.id}`} className="sk-mentor">
      <div className="sk-mentor__avatar">
        {mentor.profileImageUrl ? (
          <img src={mentor.profileImageUrl} alt={mentor.fullName} />
        ) : (
          <span>{initials(mentor.fullName)}</span>
        )}
      </div>
      <div className="sk-mentor__body">
        <strong className="sk-mentor__name">{mentor.fullName}</strong>
        {mentor.company && <span className="sk-mentor__company">{mentor.company}</span>}
        {mentor.skills && mentor.skills.length > 0 && (
          <div className="sk-mentor__skills">
            {mentor.skills.slice(0, 2).map((s) => <span key={s}>{s}</span>)}
          </div>
        )}
        <div className="sk-mentor__stats">
          <span><Icon name="star" />{mentor.averageRating > 0 ? mentor.averageRating.toFixed(1) : "—"}</span>
          <span><Icon name="timelapse" />{mentor.totalSessions} sessions</span>
        </div>
      </div>
    </Link>
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

  // ── single data fetch ──
  const [state, setState] = useState({ loading: true, data: null, error: null });

  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    (async () => {
      try {
        const [skills, mentors, savedSkills] = await Promise.all([
          apiGet("/api/v1/skills", { params: debouncedQuery ? { q: debouncedQuery } : undefined }),
          apiGet("/api/v1/users/mentors").catch(() => []),
          apiGet("/api/v1/watchlist/skills").catch(() => []),
        ]);
        if (!active) return;
        setState({ loading: false, data: { skills: skills || [], mentors: mentors || [], savedSkills: savedSkills || [] }, error: null });
      } catch (err) {
        if (!active) return;
        setState({ loading: false, data: null, error: getErrorMessage(err) });
      }
    })();

    return () => { active = false; };
  }, [debouncedQuery, refreshKey]);

  const { loading, data, error } = state;
  const skills = data?.skills || [];
  const mentors = data?.mentors || [];
  const savedSkills = data?.savedSkills || [];

  // ── mentor skill counts ──
  const mentorSkillCounts = useMemo(() => {
    const counts = new Map();
    if (skills.length && skills[0]?.mentorCount !== undefined) {
      skills.forEach((s) => counts.set(s.name.toLowerCase(), s.mentorCount));
    } else {
      mentors.forEach((m) => parseSkills(m.skills).forEach((sk) => {
        counts.set(sk.toLowerCase(), (counts.get(sk.toLowerCase()) || 0) + 1);
      }));
    }
    return counts;
  }, [skills, mentors]);

  const savedSkillNames = useMemo(
    () => new Set(savedSkills.map((i) => String(i?.skillName || i?.name || "").toLowerCase())),
    [savedSkills],
  );

  // ── categories from real data ──
  const categories = useMemo(() => {
    const seen = new Set();
    const results = [{ label: "All", icon: "apps", value: "" }];
    skills.forEach((s) => {
      const c = (s.category || "").trim();
      if (c && !seen.has(c.toLowerCase())) {
        seen.add(c.toLowerCase());
        results.push({ label: toTitle(c), icon: pickIcon(c), value: c });
      }
    });
    return results;
  }, [skills]);

  // ── filtered / sorted skills ──
  const filtered = useMemo(() => {
    let list = skills;
    if (category) {
      list = list.filter((s) => (s.category || "").toLowerCase() === category.toLowerCase());
    }
    if (difficulty) {
      list = list.filter((s) => (s.difficulty || s.level || "").toLowerCase() === difficulty.toLowerCase());
    }
    if (sortBy === "popular") list = [...list].sort((a, b) => (b.mentorCount || 0) - (a.mentorCount || 0));
    else if (sortBy === "name") list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sortBy === "newest") list = [...list].sort((a, b) => (b.id || 0) - (a.id || 0));
    return list;
  }, [skills, category, difficulty, sortBy]);

  // ── trending technologies (from skills that have mentors) ──
  const trendingTechs = useMemo(() => {
    const map = new Map();
    skills.forEach((s) => {
      const mc = mentorSkillCounts.get(s.name.toLowerCase()) || s.mentorCount || 0;
      if (mc > 0) {
        map.set(s.name, { name: s.name, mentorCount: mc });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.mentorCount - a.mentorCount).slice(0, 12);
  }, [skills, mentorSkillCounts]);

  // ── learning paths (skills grouped by category) ──
  const learningPaths = useMemo(() => {
    const groups = new Map();
    skills.forEach((s) => {
      const cat = s.category || "General";
      if (!groups.has(cat)) groups.set(cat, { category: cat, skills: [], totalMentors: 0 });
      const g = groups.get(cat);
      g.skills.push(s.name);
      g.totalMentors += mentorSkillCounts.get(s.name.toLowerCase()) || s.mentorCount || 0;
    });
    return Array.from(groups.values())
      .filter((g) => g.skills.length >= 2)
      .sort((a, b) => b.totalMentors - a.totalMentors)
      .slice(0, 6);
  }, [skills, mentorSkillCounts]);

  // ── top mentors ──
  const topMentors = useMemo(() => {
    return mentors.slice(0, 6).map((m) => ({
      id: m.id,
      fullName: m.fullName || "Mentor",
      company: m.company || m.currentCompany || "",
      skills: parseSkills(m.skills),
      profileImageUrl: m.profileImageUrl,
      averageRating: Number(m.averageRating || 0),
      totalSessions: Number(m.totalCompletedSessions || m.sessionsCompleted || 0),
    }));
  }, [mentors]);

  // ── toggle save ──
  async function toggleSave(name) {
    const norm = name.toLowerCase();
    try {
      if (savedSkillNames.has(norm)) {
        await apiDelete(`/api/v1/watchlist/skills/${encodeURIComponent(name)}`);
      } else {
        await apiPost("/api/v1/watchlist/skills", { skillName: name });
      }
      setRefreshKey((k) => k + 1);
    } catch (e) { console.error(e); }
  }

  /* ═══════ RENDER ═══════ */

  return (
    <div className="sk-shell">
      {/* ─── HERO ─── */}
      <section className="sk-hero">
        <div className="sk-hero__layout">
          <div className="sk-hero__left">
            <span className="sk-hero__badge">
              <Icon name="auto_stories" /> SKILL MARKETPLACE
            </span>
            <h1 className="sk-hero__title">
              Explore <span className="sk-hero__hl">Skills</span><br />
              That Build Real Careers
            </h1>
            <p className="sk-hero__sub">
              Browse industry-demand technologies, discover expert mentors,
              follow structured learning paths, and prepare for real software engineering careers.
            </p>
            <div className="sk-hero__features">
              <span><Icon name="check" /> Live Skill Catalog</span>
              <span><Icon name="check" /> Expert Mentors</span>
              <span><Icon name="check" /> Structured Learning Paths</span>
              <span><Icon name="check" /> Career Ready</span>
            </div>
            <div className="sk-hero__search-row">
              <label className="sk-hero__search">
                <Icon name="search" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search skills, technologies or categories..."
                  aria-label="Search skills"
                />
                {query && (
                  <button type="button" className="sk-hero__search-clr" onClick={() => setQuery("")} aria-label="Clear">
                    <Icon name="close" />
                  </button>
                )}
              </label>
              <button
                type="button"
                className={`sk-btn sk-btn--filter${showFilters ? " is-active" : ""}`}
                onClick={() => setShowFilters((v) => !v)}
              >
                <Icon name="tune" /> Filter
              </button>
              <label className="sk-hero__select">
                <Icon name="sort" />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="popular">Most Popular</option>
                  <option value="name">Name A–Z</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
              <label className="sk-hero__select">
                <Icon name="signal_cellular_alt" />
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option value="">All Levels</option>
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </label>
            </div>
          </div>
          <div className="sk-hero__right">
            <div className="sk-hero__ill">
              <div className="sk-hero__orb sk-hero__orb--1" />
              <div className="sk-hero__orb sk-hero__orb--2" />
              <div className="sk-hero__ill-card">
                <span className="sk-hero__ill-icon" style={{ background: "#0f766e" }}><Icon name="laptop" /></span>
                <span className="sk-hero__ill-icon" style={{ background: "#1d4ed8" }}><Icon name="menu_book" /></span>
                <span className="sk-hero__ill-icon" style={{ background: "#7c3aed" }}><Icon name="school" /></span>
                <span className="sk-hero__ill-icon" style={{ background: "#0369a1" }}><Icon name="code" /></span>
                <span className="sk-hero__ill-icon" style={{ background: "#059669" }}><Icon name="psychology" /></span>
                <span className="sk-hero__ill-icon" style={{ background: "#b45309" }}><Icon name="route" /></span>
              </div>
              <p className="sk-hero__ill-tag">Start your learning journey today</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FILTER PANEL ─── */}
      {showFilters && (
        <div className="sk-filter-panel">
          <div className="sk-filter__group">
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {categories.filter((c) => c.value).map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="sk-filter__group">
            <label>Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="popular">Most Popular</option>
              <option value="name">Name A–Z</option>
              <option value="newest">Newest</option>
            </select>
          </div>
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

      {/* ─── CATEGORY PILLS ─── */}
      <div className="sk-pills">
        {categories.map((c) => (
          <button
            key={c.value}
            type="button"
            className={`sk-pill${category === c.value ? " is-active" : ""}`}
            onClick={() => setCategory(c.value)}
          >
            <Icon name={c.icon} /> {c.label}
          </button>
        ))}
      </div>

      {/* ─── STATS ─── */}
      <div className="sk-stats">        
        <div className="sk-stat">
          <div className="sk-stat__icon" style={{ background: "#0f766e12", color: "#0f766e" }}><Icon name="auto_stories" /></div>
          <div className="sk-stat__body">
            <span className="sk-stat__val">{skills.length}</span>
            <span className="sk-stat__lbl">Total Skills</span>
            <span className="sk-stat__desc">In the catalogue</span>
          </div>
          <div className="sk-stat__trend" />
        </div>
        <div className="sk-stat">
          <div className="sk-stat__icon" style={{ background: "#4f46e512", color: "#4f46e5" }}><Icon name="groups" /></div>
          <div className="sk-stat__body">
            <span className="sk-stat__val">{mentors.length}</span>
            <span className="sk-stat__lbl">Expert Mentors</span>
            <span className="sk-stat__desc">Teaching mentors</span>
          </div>
          <div className="sk-stat__trend" />
        </div>
        <div className="sk-stat">
          <div className="sk-stat__icon" style={{ background: "#05966912", color: "#059669" }}><Icon name="route" /></div>
          <div className="sk-stat__body">
            <span className="sk-stat__val">{learningPaths.length}</span>
            <span className="sk-stat__lbl">Learning Paths</span>
            <span className="sk-stat__desc">Curated tracks</span>
          </div>
          <div className="sk-stat__trend" />
        </div>
        <div className="sk-stat">
          <div className="sk-stat__icon" style={{ background: "#d9770612", color: "#d97706" }}><Icon name="bookmark" /></div>
          <div className="sk-stat__body">
            <span className="sk-stat__val">{savedSkills.length}</span>
            <span className="sk-stat__lbl">Saved Skills</span>
            <span className="sk-stat__desc">On your watchlist</span>
          </div>
          <div className="sk-stat__trend" />
        </div>
        <div className="sk-stat">
          <div className="sk-stat__icon" style={{ background: "#0891b212", color: "#0891b2" }}><Icon name="group" /></div>
          <div className="sk-stat__body">
            <span className="sk-stat__val">{skills.reduce((s, sk) => s + (Number(sk.studentCount) || 0), 0)}</span>
            <span className="sk-stat__lbl">Students Learning</span>
            <span className="sk-stat__desc">Active learners</span>
          </div>
          <div className="sk-stat__trend" />
        </div>
        <div className="sk-stat">
          <div className="sk-stat__icon" style={{ background: "#8b5cf612", color: "#8b5cf6" }}><Icon name="star" /></div>
          <div className="sk-stat__body">
            <span className="sk-stat__val">{
              (() => {
                const ratings = skills.filter((s) => s.averageRating > 0).map((s) => Number(s.averageRating));
                return ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "—";
              })()
            }</span>
            <span className="sk-stat__lbl">Average Rating</span>
            <span className="sk-stat__desc">Across skills</span>
          </div>
          <div className="sk-stat__trend" />
        </div>
      </div>

      {/* ─── FEATURED SKILLS ─── */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title">
            <Icon name="grid_view" />
            {category ? `${category} Skills` : debouncedQuery ? `Results for "${debouncedQuery}"` : "Featured Skills"}
          </h2>
          {!loading && <span className="sk-section__count">{filtered.length} skills</span>}
        </div>

        {loading ? (
          <div className="sk-grid">
            {Array.from({ length: 8 }).map((_, i) => <SkillSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="sk-error">
            <div className="sk-error__icon"><Icon name="error" /></div>
            <p className="sk-error__title">Skills could not be loaded</p>
            <p className="sk-error__desc">{error}</p>
            <button type="button" className="sk-btn sk-btn--primary sk-btn--sm" onClick={() => setRefreshKey((k) => k + 1)}>
              <Icon name="refresh" /> Retry
            </button>
          </div>
        ) : filtered.length > 0 ? (
          <div className="sk-grid">
            {filtered.map((skill) => (
              <SkillCard
                key={skill.id || skill.name}
                skill={skill}
                mentorCount={mentorSkillCounts.get(skill.name.toLowerCase()) || skill.mentorCount || 0}
                saved={savedSkillNames.has(skill.name.toLowerCase())}
                onToggle={toggleSave}
              />
            ))}
          </div>
        ) : (
          <div className="sk-empty">
            <div className="sk-empty__icon"><Icon name="search_off" /></div>
            <h3 className="sk-empty__title">No matching skills found</h3>
            <p className="sk-empty__desc">Try another keyword or browse different categories.</p>
            <button type="button" className="sk-btn sk-btn--primary sk-btn--sm" onClick={() => { setQuery(""); setCategory(""); }}>
              <Icon name="restart_alt" /> Reset Filters
            </button>
          </div>
        )}
      </section>

      {/* ─── LEARNING PATHS (derived from skill categories) ─── */}
      {learningPaths.length > 0 && (
        <section>
          <div className="sk-section__head">
            <h2 className="sk-section__title">
              <Icon name="trending_up" /> Trending Learning Paths
            </h2>
            <Link to="/learner/path" className="sk-section__link">
              View All <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="sk-paths-scroll">
            {learningPaths.map((lp) => (
              <div key={lp.category} className="sk-path-card" style={{ borderTop: `3px solid ${pickGradient(lp.category)}` }}>
                <div className="sk-path-card__thumb" style={{ background: pickGradient(lp.category) }}>
                  <Icon name={pickIcon(lp.category)} />
                </div>
                <div className="sk-path-card__body">
                  <h3 className="sk-path-card__title">{lp.category}</h3>
                  <div className="sk-path-card__meta">
                    <span><Icon name="auto_stories" /> {lp.skills.length} skills</span>
                    <span><Icon name="person" /> {lp.totalMentors} mentors</span>
                  </div>
                  <div className="sk-path-card__chips">
                    {lp.skills.slice(0, 4).map((sk) => (
                      <span key={sk} className="sk-path-card__chip">{sk}</span>
                    ))}
                    {lp.skills.length > 4 && <span className="sk-path-card__chip sk-path-card__chip--more">+{lp.skills.length - 4}</span>}
                  </div>
                  <Link to="/learner/path" className="sk-btn sk-btn--primary sk-btn--sm">
                    <Icon name="route" /> View Path
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── TRENDING TECHNOLOGIES ─── */}
      {trendingTechs.length > 0 && (
        <section>
          <div className="sk-section__head">
            <h2 className="sk-section__title">
              <Icon name="local_fire_department" /> Popular Technologies
            </h2>
          </div>
          <div className="sk-tech-grid">
            {trendingTechs.map((t) => {
              const meta = techMeta(t.name);
              return (
                <button
                  key={t.name}
                  type="button"
                  className="sk-tech-chip"
                  onClick={() => setQuery(t.name)}
                >
                  <span className="sk-tech-chip__icon" style={{ color: meta.color }}>
                    <Icon name={meta.icon} />
                  </span>
                  <span className="sk-tech-chip__name">{t.name}</span>
                  <span className="sk-tech-chip__count">{t.mentorCount} mentors</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── RECOMMENDED FOR YOU ─── */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title">
            <Icon name="recommend" /> Recommended for You
          </h2>
        </div>
        <div className="sk-empty" style={{ padding: "32px 20px" }}>
          <div className="sk-empty__icon" style={{ width: 52, height: 52 }}><Icon name="auto_awesome" /></div>
          <h3 className="sk-empty__title">Personalized recommendations coming soon</h3>
          <p className="sk-empty__desc">
            As you explore skills and save your interests, we&rsquo;ll recommend the best skills,
            mentors, and learning paths tailored just for you.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {categories.filter((c) => c.value).slice(0, 6).map((c) => (
              <button
                key={c.value}
                type="button"
                className="sk-btn sk-btn--outline sk-btn--sm"
                onClick={() => { setCategory(c.value); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              >
                <Icon name={c.icon} /> {c.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TOP MENTORS ─── */}
      {topMentors.length > 0 && (
        <section>
          <div className="sk-section__head">
            <h2 className="sk-section__title">
              <Icon name="groups" /> Top Mentors
            </h2>
            <Link to="/learner/mentors" className="sk-section__link">
              View All <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="sk-mentor-grid">
            {topMentors.map((m) => <MentorMiniCard key={m.id} mentor={m} />)}
          </div>
        </section>
      )}
    </div>
  );
}
