import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

/* ───────────── constants ───────────── */
const EMPTY_ARRAY = [];

const FEATURED_SKILLS = [
  { name: "Java", category: "Backend", difficulty: "intermediate", description: "Build enterprise-grade applications with Java, one of the most versatile and widely-used programming languages in the world.", learners: 12000, mentors: 45, rating: 4.5 },
  { name: "React", category: "Frontend", difficulty: "beginner", description: "Master React to build fast, interactive user interfaces. The most popular frontend library for modern web apps.", learners: 25000, mentors: 60, rating: 4.8 },
  { name: "Spring Boot", category: "Backend", difficulty: "intermediate", description: "Create production-grade Spring-based applications with minimal fuss. The go-to framework for Java microservices.", learners: 8000, mentors: 30, rating: 4.3 },
  { name: "Python", category: "AI / Machine Learning", difficulty: "beginner", description: "Learn Python programming from scratch. The most beginner-friendly language powering AI, data science, and automation.", learners: 30000, mentors: 55, rating: 4.7 },
  { name: "Node.js", category: "Backend", difficulty: "intermediate", description: "Build scalable server-side applications with JavaScript. Event-driven architecture for modern backends.", learners: 15000, mentors: 40, rating: 4.4 },
  { name: "AWS", category: "Cloud Computing", difficulty: "advanced", description: "Master Amazon Web Services — the world's leading cloud platform. From EC2 to Lambda, deploy at scale.", learners: 10000, mentors: 35, rating: 4.6 },
  { name: "Docker", category: "DevOps", difficulty: "intermediate", description: "Containerise your applications with Docker. Simplify deployment, scaling, and environment consistency.", learners: 7000, mentors: 25, rating: 4.2 },
  { name: "SQL", category: "Data Science", difficulty: "beginner", description: "Query and manage relational databases with SQL. An essential skill for every developer and data professional.", learners: 20000, mentors: 20, rating: 4.1 },
];

const LEARNING_PATHS_DATA = [
  {
    id: "java-developer",
    title: "Java Developer",
    icon: "code",
    gradient: "linear-gradient(135deg,#ed8b00,#e8a530)",
    steps: ["Java", "OOP", "Collections", "Spring", "Spring Boot", "REST APIs", "Microservices"],
    duration: "6-9 months",
    skills: 7,
  },
  {
    id: "frontend-developer",
    title: "Frontend Developer",
    icon: "web",
    gradient: "linear-gradient(135deg,#61dafb,#3178c6)",
    steps: ["HTML", "CSS", "JavaScript", "React", "Redux", "Next.js"],
    duration: "4-8 months",
    skills: 6,
  },
  {
    id: "python-developer",
    title: "Python Developer",
    icon: "code",
    gradient: "linear-gradient(135deg,#3776ab,#306998)",
    steps: ["Python", "OOP", "Libraries", "Flask", "APIs", "Automation"],
    duration: "4-7 months",
    skills: 6,
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    icon: "cloud",
    gradient: "linear-gradient(135deg,#FF9900,#232F3E)",
    steps: ["Cloud Basics", "EC2", "S3", "Lambda", "Docker", "CI/CD"],
    duration: "6-10 months",
    skills: 6,
  },
];

const CAREERS_DATA = [
  { id: "backend-developer", title: "Backend Developer", icon: "dns", color: "#0F9D8A", salary: "₹8-20 LPA", skills: "Java, Spring Boot, SQL", experience: "1-3 years" },
  { id: "frontend-developer", title: "Frontend Developer", icon: "web", color: "#3B82F6", salary: "₹6-18 LPA", skills: "React, JavaScript, CSS", experience: "1-3 years" },
  { id: "full-stack-developer", title: "Full Stack Developer", icon: "code", color: "#8B5CF6", salary: "₹10-25 LPA", skills: "React, Node.js, MongoDB", experience: "2-5 years" },
  { id: "cloud-engineer", title: "Cloud Engineer", icon: "cloud", color: "#EC4899", salary: "₹12-30 LPA", skills: "AWS, Docker, Kubernetes", experience: "3-6 years" },
  { id: "ai-engineer", title: "AI Engineer", icon: "psychology", color: "#F59E0B", salary: "₹15-35 LPA", skills: "Python, ML, Deep Learning", experience: "2-5 years" },
  { id: "devops-engineer", title: "DevOps Engineer", icon: "terminal", color: "#EF4444", salary: "₹10-28 LPA", skills: "Docker, K8s, CI/CD", experience: "2-5 years" },
  { id: "data-analyst", title: "Data Analyst", icon: "analytics", color: "#14B8A6", salary: "₹5-15 LPA", skills: "SQL, Python, Statistics", experience: "0-2 years" },
];

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

const SAMPLE_MENTORS = [
  { id: "sample-1", fullName: "Priya Sharma", company: "Google", skills: ["Java", "Spring Boot", "Microservices"], averageRating: 4.8, totalSessions: 340, profileImageUrl: null },
  { id: "sample-2", fullName: "Rahul Verma", company: "Microsoft", skills: ["React", "TypeScript", "Next.js"], averageRating: 4.6, totalSessions: 280, profileImageUrl: null },
  { id: "sample-3", fullName: "Aisha Kapoor", company: "Amazon", skills: ["AWS", "Docker", "Kubernetes"], averageRating: 4.7, totalSessions: 195, profileImageUrl: null },
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

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

function skillDifficulty(skill) {
  const raw = skill?.difficulty || skill?.level || "";
  if (raw) return raw.toLowerCase();
  const n = (skill?.name || "").length;
  return DIFFICULTIES[n % 3];
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
  return map[skillDifficulty(skill)] || "4–8 weeks";
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
  const cat = skill.category || "General";
  const diffMeta = difficultyMeta(skillDifficulty(skill));
  const time = estimatedTime(skill);
  const slug = slugify(skill.name);
  return (
    <Link to={`/learner/skills/${slug}`} className="sk-card md-animate" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column" }}>
      <div className="sk-card__hdr" style={{ background: pickGradient(skill.name || cat) }}>
        <Icon name={pickIcon(cat)} />
      </div>
      <div className="sk-card__body">
        <div className="sk-card__top">
          <h3 className="sk-card__title">{skill.name}</h3>
          <span className="sk-card__cat">{cat}</span>
        </div>
        <p className="sk-card__desc">{skill.description?.slice(0, 100) || ""}{skill.description?.length > 100 ? "…" : ""}</p>
        <div className="sk-card__badges">
          <span className="sk-card__diff" style={{ background: diffMeta.bg, color: diffMeta.color }}>
            <Icon name={diffMeta.icon} /> {diffMeta.label}
          </span>
          <span className="sk-card__time"><Icon name="schedule" /> {time}</span>
        </div>
        <div className="sk-card__meta">
          <div className="sk-card__mi"><Icon name="people" /><strong>{(skill.learners || 0).toLocaleString()}</strong><span>learners</span></div>
          <div className="sk-card__mi"><Icon name="person" /><strong>{skill.mentors || 0}</strong><span>mentors</span></div>
          {skill.rating > 0 && (
            <div className="sk-card__mi"><Icon name="star" /><strong>{Number(skill.rating).toFixed(1)}</strong><span>rating</span></div>
          )}
        </div>
        <div className="sk-card__actions">
          <Link to={`/learner/skills/${slug}`} className="sk-card__roadmap-link" onClick={(e) => e.stopPropagation()}>
            <Icon name="route" /> Explore Roadmap
          </Link>
          <Link to={`/learner/mentors?skill=${encodeURIComponent(skill.name)}`} className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn" onClick={(e) => e.stopPropagation()}>
            <Icon name="person_search" /> Find Mentor
          </Link>
        </div>
      </div>
    </Link>
  );
}

function PathCard({ path }) {
  return (
    <div className="sk-path-card--catalog md-animate">
      <div className="sk-path-card--catalog__header" style={{ background: path.gradient }}>
        <Icon name={path.icon} />
        <h3>{path.title}</h3>
        <span className="sk-path-card--catalog__duration"><Icon name="schedule" /> {path.duration}</span>
      </div>
      <div className="sk-path-card--catalog__body">
        <div className="sk-path-card--catalog__steps">
          {path.steps.slice(0, 4).map((step, i) => (
            <span key={step} className="sk-path-step">
              <span className="sk-path-step__dot" />
              {step}
              {i < path.steps.slice(0, 4).length - 1 && <span className="sk-path-step__line" />}
            </span>
          ))}
          {path.steps.length > 4 && <span className="sk-path-step__more">+{path.steps.length - 4} more</span>}
        </div>
        <div className="sk-path-card--catalog__meta">
          <span><Icon name="auto_stories" /> {path.skills} skills</span>
          <span>&bull;</span>
          <span><Icon name="schedule" /> {path.duration}</span>
        </div>
      </div>
      <div className="sk-path-card--catalog__actions">
        <Link to={`/learner/roadmaps/${path.id}`} className="sk-card__roadmap-link">
          <Icon name="route" /> View Roadmap
        </Link>
        <Link to={`/learner/mentors?skill=${encodeURIComponent(path.steps[0])}`} className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn">
          <Icon name="person_search" /> Find Mentor
        </Link>
      </div>
    </div>
  );
}

function CareerCard({ career }) {
  return (
    <div className="sk-career-card--catalog md-animate">
      <Link to={`/learner/careers/${career.id}`} style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="sk-career-card--catalog__top">
          <span className="sk-career-card--catalog__icon" style={{ color: career.color }}>
            <Icon name={career.icon} />
          </span>
          <h3 className="sk-career-card--catalog__title">{career.title}</h3>
        </div>
        <div className="sk-career-card--catalog__salary">
          <Icon name="currency_rupee" /> {career.salary}
        </div>
        <div className="sk-career-card--catalog__detail">
          <span className="sk-career-card--catalog__label">Skills needed:</span>
          <span className="sk-career-card--catalog__value">{career.skills}</span>
        </div>
        <div className="sk-career-card--catalog__detail">
          <span className="sk-career-card--catalog__label">Experience:</span>
          <span className="sk-career-card--catalog__value">{career.experience}</span>
        </div>
      </Link>
      <div className="sk-career-card--catalog__actions">
        <Link to={`/learner/careers/${career.id}`} className="sk-card__roadmap-link">
          <Icon name="open_in_new" /> View Career
        </Link>
        <Link to={`/learner/mentors?skill=${encodeURIComponent(career.skills.split(",")[0].trim())}`} className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn">
          <Icon name="person_search" /> Find Mentor
        </Link>
      </div>
    </div>
  );
}

function ResourceCard({ resource, skillName }) {
  const url = resourceUrl(skillName, resource.title);
  return (
    <div className="sk-resource-card--catalog md-animate">
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <div className="sk-resource-card--catalog__icon" style={{ background: resource.color }}>
          <Icon name={resource.icon} />
        </div>
        <h4 className="sk-resource-card--catalog__title">{resource.title}</h4>
        <p className="sk-resource-card--catalog__desc">{resource.desc}</p>
      </a>
      <div className="sk-resource-card--catalog__actions">
        <a href={url} target="_blank" rel="noopener noreferrer" className="sk-card__roadmap-link">
          <Icon name="open_in_new" /> Open Resource
        </a>
        <a href={url} target="_blank" rel="noopener noreferrer" className="sk-btn sk-btn--primary sk-btn--sm sk-card__mentor-btn" style={{ textDecoration: "none" }}>
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
          <span className="sk-mentor--catalog__sessions">{mentor.totalSessions} sessions</span>
        </div>
        {mentor.skills && mentor.skills.length > 0 && (
          <div className="sk-mentor--catalog__skills">
            {mentor.skills.slice(0, 2).map((s) => <span key={s}>{s}</span>)}
          </div>
        )}
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

  // ── data fetch with sample fallback ──
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
        // If API returned empty data, use sample data
        const finalSkills = (skills && skills.length > 0) ? skills : FEATURED_SKILLS;
        const finalMentors = (mentors && mentors.length > 0) ? mentors : SAMPLE_MENTORS;
        setState({ loading: false, data: { skills: finalSkills, mentors: finalMentors, savedSkills: savedSkills || EMPTY_ARRAY }, error: null });
      } catch (err) {
        if (!active) return;
        // On error, use sample data so the page always looks complete
        setState({ loading: false, data: { skills: FEATURED_SKILLS, mentors: SAMPLE_MENTORS, savedSkills: EMPTY_ARRAY }, error: null });
      }
    })();

    return () => { active = false; };
  }, [debouncedQuery, refreshKey]);

  const { loading, data } = state;
  const skills = data?.skills || FEATURED_SKILLS;
  const mentors = data?.mentors || SAMPLE_MENTORS;
  const savedSkills = data?.savedSkills || EMPTY_ARRAY;

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
        const skills = parseSkills(m.skills);
        return skills.some((s) => s.toLowerCase().includes(q));
      });
    }
    return list.slice(0, 3).map((m) => ({
      id: m.id || m.mentorId,
      fullName: m.fullName || m.mentorName || "Mentor",
      company: m.company || m.currentCompany || "",
      skills: parseSkills(m.skills),
      profileImageUrl: m.profileImageUrl,
      averageRating: Number(m.averageRating || 0),
      totalSessions: Number(m.totalCompletedSessions || m.sessionsCompleted || m.totalSessions || 0),
    }));
  }, [mentors, debouncedQuery]);

  // ── filtered learning paths (search-aware) ──
  const filteredPaths = useMemo(() => {
    if (!debouncedQuery) return LEARNING_PATHS_DATA;
    const q = debouncedQuery.toLowerCase();
    return LEARNING_PATHS_DATA.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.steps.some((s) => s.toLowerCase().includes(q))
    );
  }, [debouncedQuery]);

  // ── filtered careers (search-aware) ──
  const filteredCareers = useMemo(() => {
    if (!debouncedQuery) return CAREERS_DATA;
    const q = debouncedQuery.toLowerCase();
    return CAREERS_DATA.filter((c) =>
      c.title.toLowerCase().includes(q) ||
      c.skills.toLowerCase().includes(q)
    );
  }, [debouncedQuery]);

  const savedSkillNames = useMemo(
    () => new Set(savedSkills.map((i) => String(i?.skillName || i?.name || "").toLowerCase())),
    [savedSkills],
  );

  async function toggleSave(name) {
    const norm = name.toLowerCase();
    try {
      if (savedSkillNames.has(norm)) {
        await apiDelete(`/api/v1/watchlist/skills/${encodeURIComponent(name)}`).catch(() => {});
      } else {
        await apiPost("/api/v1/watchlist/skills", { skillName: name }).catch(() => {});
      }
      setRefreshKey((k) => k + 1);
    } catch (e) { console.error(e); }
  }

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
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* ═══ 1. HERO ═══ */}
      <section className="mp-hero">
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>auto_stories</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_stories</span>
            SKILLS
          </div>
          <h1>Explore Skills</h1>
          <p className="mp-hero__sub">
            Discover in-demand technologies, learning paths, and mentors to accelerate your career.
          </p>
          <div className="mp-hero__actions" style={{ flexWrap: "wrap", gap: 8 }}>
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
            <label className="sk-hero__select" style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff", borderRadius: "var(--mp-radius)", padding: "8px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="signal_cellular_alt" style={{ color: "rgba(255,255,255,0.60)", fontSize: 18 }} />
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={{ background: "transparent", border: "none", color: "#fff", fontFamily: "inherit", fontWeight: 600, fontSize: "0.82rem", outline: "none" }}>
                <option value="" style={{ color: "#111" }}>All Levels</option>
                <option value="beginner" style={{ color: "#111" }}>Beginner</option>
                <option value="intermediate" style={{ color: "#111" }}>Intermediate</option>
                <option value="advanced" style={{ color: "#111" }}>Advanced</option>
              </select>
            </label>
          </div>
        </div>
      </section>

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
          <div className="sk-filter__group">
            <label>Difficulty</label>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
              <option value="">All Levels</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
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

      {/* ─── Category Pills ─── */}
      <div className="sk-pills">
        {categories.map((c) => (
          <button key={c.value} type="button" className={`sk-pill${category === c.value ? " is-active" : ""}`} onClick={() => setCategory(c.value)}>
            <Icon name={c.icon} /> {c.label}
          </button>
        ))}
      </div>

      {/* ─── Difficulty Pills ─── */}
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

      {/* ═══ 2. FEATURED SKILLS ═══ */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title">
            <Icon name="grid_view" />
            {category ? `${category} Skills` : debouncedQuery ? `Results for "${debouncedQuery}"` : "Featured Skills"}
          </h2>
          <span className="sk-section__count">{filtered.length} skill{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
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
        ) : null}
      </section>

      {/* ═══ REMOVED: Browse Categories — redundant since this is already Explore Skills ═══ */}

      {/* ═══ 3. LEARNING PATHS ═══ */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title"><Icon name="route" /> Learning Paths</h2>
          <Link to={`/learner/roadmaps/${LEARNING_PATHS_DATA[0].id}`} className="sk-section__link">View All <Icon name="arrow_forward" /></Link>
        </div>
        <div className="sk-paths-scroll">
          {filteredPaths.map((path) => <PathCard key={path.title} path={path} />)}
        </div>
      </section>

      {/* ═══ 4. CAREER OPPORTUNITIES ═══ */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title"><Icon name="work" /> Career Opportunities</h2>
          <span className="sk-section__count">{filteredCareers.length} career{filteredCareers.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="sk-career-grid--catalog">
          {filteredCareers.map((career) => <CareerCard key={career.title} career={career} />)}
        </div>
      </section>

      {/* ═══ 5. LEARNING RESOURCES ═══ */}
      <section>
        <div className="sk-section__head">
          <h2 className="sk-section__title"><Icon name="school" /> Learning Resources</h2>
          <span className="sk-section__count">{RESOURCES_DATA.length} resources</span>
        </div>
        <div className="sk-resources-grid--catalog">
          {RESOURCES_DATA.map((r) => <ResourceCard key={r.title} resource={r} skillName={debouncedQuery || skills[0]?.name || ""} />)}
        </div>
      </section>

      {/* ═══ 6. RECOMMENDED MENTORS (max 3) ═══ */}
      {topMentors.length > 0 && (
        <section>
          <div className="sk-section__head">
            <h2 className="sk-section__title"><Icon name="groups" /> Recommended Mentors</h2>
            <Link to="/learner/mentors" className="sk-section__link">Browse All <Icon name="arrow_forward" /></Link>
          </div>
          <div className="sk-mentor-grid--catalog">
            {topMentors.slice(0, 3).map((m) => <MentorMiniCard key={m.id} mentor={m} />)}
          </div>
          <div className="sk-mentor-footer">
            <p>Looking for more options? Browse our full mentor marketplace with detailed profiles, reviews, and direct booking.</p>
            <Link to="/learner/mentors" className="sk-btn sk-btn--primary">
              <Icon name="person_search" /> View All Mentors
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
