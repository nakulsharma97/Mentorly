import { normalizeSkills } from "../../../../utils/skills";

/* ==========================================================================
   Shared helpers
   ========================================================================== */

export const EMPTY_ARRAY = [];

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export const dayKey = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

export function greetingByHour(hour = new Date().getHours()) {
  if (hour < 5) return "Good Night";
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/* ==========================================================================
   Booking aggregates
   ========================================================================== */

export function buildBookingStats(bookings) {
  const now = Date.now();
  const upcoming = (bookings || EMPTY_ARRAY).filter((b) => {
    const t = new Date(b?.session?.startTime || 0).getTime();
    return Number.isFinite(t) && t >= now;
  });
  const completed = (bookings || EMPTY_ARRAY).filter(
    (b) => String(b?.bookingStatus || "").toUpperCase() === "COMPLETED",
  );
  const totalHours = completed.reduce((sum, b) => {
    const s = new Date(b?.session?.startTime || 0).getTime();
    const e = new Date(b?.session?.endTime || 0).getTime();
    if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return sum;
    return sum + (e - s) / 3600000;
  }, 0);
  return {
    upcoming,
    completed,
    totalHours: Math.round(totalHours * 10) / 10,
  };
}

export function computeStreak(bookings) {
  const daySet = new Set(
    (bookings || EMPTY_ARRAY)
      .filter((b) => String(b?.bookingStatus || "").toUpperCase() === "COMPLETED")
      .map((b) => dayKey(b?.session?.startTime))
      .filter(Boolean),
  );
  if (!daySet.size) return 0;
  const days = [...daySet].sort().reverse();
  let streak = 1;
  let prev = new Date(days[0]);
  for (let i = 1; i < days.length; i += 1) {
    const cur = new Date(days[i]);
    const diff = Math.round((prev - cur) / 86400000);
    if (diff === 1) {
      streak += 1;
      prev = cur;
    } else if (diff !== 0) break;
  }
  return streak;
}

/* ==========================================================================
   Career path catalogs (used as graceful guidance when a roadmap has no
   milestones — the Mentorly path templates live here).
   ========================================================================== */

const MILESTONE_LIBRARY = [
  {
    title: "Java Basics",
    icon: "code",
    weeks: 2,
    difficulty: "Beginner",
    description:
      "Syntax, variables, operators, loops, arrays and the JDK toolchain. Build a rock-solid foundation before anything else.",
    skills: ["Java SE", "JDK", "IntelliJ"],
    resources: {
      videos: ["Java for Beginners — full course", "Primitive types & operators"],
      docs: ["Official Java Tutorials", "OpenJDK Documentation"],
      books: ["Head First Java", "Effective Java (later)"],
      practice: ["HackerRank Java track", "Codecademy Java"],
    },
    project: "Console calculator with input validation",
    tasks: ["Set up JDK + IDE", "Complete 10 coding drills", "Build console calculator"],
  },
  {
    title: "OOP",
    icon: "widgets",
    weeks: 2,
    difficulty: "Beginner",
    description:
      "Classes, objects, inheritance, polymorphism, encapsulation and interfaces — the mental model behind every framework.",
    skills: ["Classes", "Inheritance", "Interfaces"],
    resources: {
      videos: ["OOP in Java — deep dive", "Inheritance vs composition"],
      docs: ["Java Language Spec — Classes", "Oracle OOP concepts"],
      books: ["Head First Java (OOP chapters)", "Clean Code"],
      practice: ["Design a bank account system", "Zoo inheritance exercise"],
    },
    project: "Library catalog system with inheritance",
    tasks: ["Model a domain with 5+ classes", "Refactor with interfaces", "Code review a peer project"],
  },
  {
    title: "Collections",
    icon: "inventory_2",
    weeks: 2,
    difficulty: "Beginner",
    description:
      "List, Set, Map, Queue and their implementations. Know when to use what — interviewers love this.",
    skills: ["ArrayList", "HashMap", "Streams"],
    resources: {
      videos: ["Java Collections framework explained", "HashMaps under the hood"],
      docs: ["java.util — Collections overview", "Stream API guide"],
      books: ["Effective Java (Items on collections)", "Java Generics book"],
      practice: ["LeetCode 'Top K Frequent'", "Sorting with comparators"],
    },
    project: "In-memory expense tracker using Map & List",
    tasks: ["Solve 8 collection problems", "Implement a custom comparator", "Build expense tracker"],
  },
  {
    title: "Exception Handling",
    icon: "report",
    weeks: 1,
    difficulty: "Beginner",
    description:
      "Checked vs unchecked exceptions, try/catch/finally, try-with-resources and fail-fast vs fail-safe design.",
    skills: ["try/catch", "Custom exceptions", "Logging"],
    resources: {
      videos: ["Java exceptions — complete guide", "Best practices for errors"],
      docs: ["Java Tutorials — Exceptions", "SLF4J logging guide"],
      books: ["Effective Java (exceptions items)", "Clean Code (error handling)"],
      practice: ["Convert a fragile program to throw", "Write a custom exception hierarchy"],
    },
    project: "Robust CSV parser with graceful errors",
    tasks: ["Add error handling to 1 project", "Write 5 unit tests for failures", "Add structured logging"],
  },
  {
    title: "Spring Boot",
    icon: "rocket_launch",
    weeks: 3,
    difficulty: "Intermediate",
    description:
      "Dependency injection, autoconfiguration, starters, profiles and the actuator. The core framework of the Java backend world.",
    skills: ["Spring IoC", "Starters", "Actuator"],
    resources: {
      videos: ["Spring Boot crash course", "Building a REST service with Spring"],
      docs: ["Spring Boot Reference", "Spring Initializr"],
      books: ["Spring Start Here", "Spring in Action"],
      practice: ["Build a /hello endpoint", "Add a configuration profile"],
    },
    project: "Todo REST API with in-memory storage",
    tasks: ["Scaffold via Spring Initializr", "Expose CRUD endpoints", "Wire up actuator health"],
  },
  {
    title: "REST APIs",
    icon: "api",
    weeks: 2,
    difficulty: "Intermediate",
    description:
      "HTTP semantics, resource design, status codes, validation, versioning and OpenAPI documentation.",
    skills: ["HTTP verbs", "JSON", "OpenAPI"],
    resources: {
      videos: ["Designing great REST APIs", "REST API best practices"],
      docs: ["MDN HTTP guide", "OpenAPI Specification"],
      books: ["Designing Data-Intensive Applications (ch. 1)", "RESTful Web APIs"],
      practice: ["Design an API for a blog", "Document it with OpenAPI"],
    },
    project: "Blog API with full CRUD + validation",
    tasks: ["Model resources", "Add Bean Validation", "Generate OpenAPI docs"],
  },
  {
    title: "Spring Security",
    icon: "security",
    weeks: 2,
    difficulty: "Intermediate",
    description:
      "Authentication, authorization, method security, CSRF, CORS and password hashing — protect every endpoint.",
    skills: ["Authentication", "Authorization", "CSRF/CORS"],
    resources: {
      videos: ["Spring Security in 1 hour", "Securing REST endpoints"],
      docs: ["Spring Security Reference", "OWASP Cheat Sheets"],
      books: ["Spring Security in Action"],
      practice: ["Lock down your blog API", "Add role-based access"],
    },
    project: "Secure the blog API with role-based access",
    tasks: ["Configure SecurityFilterChain", "Add roles + authorities", "Test unauth requests"],
  },
  {
    title: "JPA & Hibernate",
    icon: "database",
    weeks: 2,
    difficulty: "Intermediate",
    description:
      "Entities, repositories, relationships, JPQL, transactions and the N+1 problem — master data access.",
    skills: ["JPA entities", "Repositories", "Transactions"],
    resources: {
      videos: ["JPA & Hibernate fundamentals", "Fixing the N+1 problem"],
      docs: ["Jakarta Persistence Spec", "Hibernate User Guide"],
      books: ["Java Persistence with Hibernate"],
      practice: ["Model a 1-to-many relationship", "Write native + JPQL queries"],
    },
    project: "Library management system with JPA",
    tasks: ["Design schema", "Map entities + relations", "Add pagination queries"],
  },
  {
    title: "JWT Authentication",
    icon: "key",
    weeks: 2,
    difficulty: "Intermediate",
    description:
      "Token issuance, refresh flows, stateless sessions and securing every endpoint with signed JWTs.",
    skills: ["JWT", "Refresh tokens", "Filters"],
    resources: {
      videos: ["JWT authentication explained", "Secure refresh token flow"],
      docs: ["jwt.io", "Spring Security JWT guide"],
      books: ["Spring Security in Action (JWT chapters)"],
      practice: ["Implement login + refresh", "Add a protected resource"],
    },
    project: "Add JWT auth to the library system",
    tasks: ["Issue access + refresh tokens", "Add security filter", "Test protected endpoints"],
  },
  {
    title: "Microservices",
    icon: "account_tree",
    weeks: 3,
    difficulty: "Advanced",
    description:
      "Service boundaries, API gateways, service discovery, resilience patterns and distributed tracing.",
    skills: ["Service mesh", "API Gateway", "Resilience"],
    resources: {
      videos: ["Microservices architecture explained", "Building microservices with Spring Cloud"],
      docs: ["Spring Cloud Documentation", "Microservices.io patterns"],
      books: ["Building Microservices (Sam Newman)"],
      practice: ["Split your app into 2 services", "Add a gateway"],
    },
    project: "Split the app into 2–3 services",
    tasks: ["Define service boundaries", "Add service-to-service calls", "Add circuit breaker"],
  },
  {
    title: "Docker",
    icon: "docker",
    weeks: 2,
    difficulty: "Advanced",
    description:
      "Containerize Java apps, write multi-stage Dockerfiles, orchestrate with compose and keep images lean.",
    skills: ["Dockerfile", "docker-compose", "Images"],
    resources: {
      videos: ["Docker for developers", "Multi-stage builds"],
      docs: ["Docker Reference", "Docker Compose Docs"],
      books: ["Docker Deep Dive"],
      practice: ["Containerize your blog API", "Add Postgres via compose"],
    },
    project: "Dockerize the microservices with compose",
    tasks: ["Write multi-stage Dockerfile", "Compose Postgres + app", "Health-check containers"],
  },
  {
    title: "AWS",
    icon: "cloud",
    weeks: 2,
    difficulty: "Advanced",
    description:
      "EC2, S3, RDS and IAM basics — deploy a real service to the cloud and understand the core primitives.",
    skills: ["EC2", "S3", "RDS"],
    resources: {
      videos: ["AWS essentials for developers", "Deploy a Spring Boot app to EC2"],
      docs: ["AWS Getting Started", "AWS IAM docs"],
      books: ["AWS in Action"],
      practice: ["Launch an EC2 instance", "Store uploads in S3"],
    },
    project: "Deploy a service to EC2 with S3 storage",
    tasks: ["Create IAM user + roles", "Deploy the app", "Add S3 for uploads"],
  },
  {
    title: "CI/CD",
    icon: "sync_alt",
    weeks: 2,
    difficulty: "Advanced",
    description:
      "GitHub Actions pipelines, automated tests, container registry pushes and zero-downtime deploys.",
    skills: ["GitHub Actions", "Pipelines", "Deploys"],
    resources: {
      videos: ["GitHub Actions full course", "Continuous delivery explained"],
      docs: ["GitHub Actions Docs", "12-factor app"],
      books: ["Continuous Delivery (Humble & Farley)"],
      practice: ["Build a pipeline that runs tests", "Add a deploy job"],
    },
    project: "CI/CD pipeline for your deployed service",
    tasks: ["Add lint+test job", "Push image to registry", "Auto-deploy on main"],
  },
  {
    title: "Interview Preparation",
    icon: "quiz",
    weeks: 2,
    difficulty: "Career",
    description:
      "DSA warm-up, system design basics, behavioral stories and live mock interviews with mentors.",
    skills: ["DSA", "System design", "Mock interviews"],
    resources: {
      videos: ["Coding interview prep", "System design fundamentals"],
      docs: ["LeetCode patterns", "Grokking system design"],
      books: ["Cracking the Coding Interview"],
      practice: ["LeetCode daily challenges", "1 mock interview / week"],
    },
    project: "Portfolio website + resume refresh",
    tasks: ["Solve 20 LeetCode problems", "Book 2 mock interviews", "Polish resume"],
  },
  {
    title: "Job Ready",
    icon: "flag",
    weeks: 1,
    difficulty: "Career",
    description:
      "You've built the skills, shipped real projects and passed interviews — time to apply with confidence.",
    skills: ["Resume", "Applications", "Negotiation"],
    resources: {
      videos: ["Job search strategy", "Salary negotiation"],
      docs: ["Resume guides", "LinkedIn optimization"],
      books: ["Never Split the Difference"],
      practice: ["Send 10 tailored applications", "Build a referral network"],
    },
    project: "Apply to your top 10 companies",
    tasks: ["Finalize resume", "Apply to 10 roles", "Track interviews"],
  },
];

/** Fuzzy-lookup enrichment metadata for a milestone title (case-insensitive). */
function enrichMilestone(title) {
  const t = String(title || "").trim().toLowerCase();
  const match = MILESTONE_LIBRARY.find((m) => m.title.toLowerCase() === t);
  if (match) return match;
  // Partial match fallback (e.g. "Spring Boot Basics" → Spring Boot guide)
  const partial = MILESTONE_LIBRARY.find((m) => t.includes(m.title.toLowerCase()));
  if (partial) return partial;
  return {
    title: String(title || "Milestone").trim(),
    icon: "school",
    weeks: 2,
    difficulty: "Intermediate",
    description: `Master ${String(title || "this topic").trim()} with mentor-led sessions, hands-on practice and a mini project.`,
    skills: normalizeSkills(String(title || "")).length
      ? normalizeSkills(String(title || ""))
      : [String(title || "Milestone").trim()],
    resources: {
      videos: ["Curated video for this topic"],
      docs: ["Official documentation"],
      books: ["Recommended reading"],
      practice: ["Practice exercises on this topic"],
    },
    project: `Mini project on ${String(title || "this topic").trim()}`,
    tasks: [
      `Study ${String(title || "this topic").trim()}`,
      "Complete guided practice",
      "Build the mini project",
    ],
  };
}

/** Build an enriched milestone list from a roadmap (or default career path). */
export function buildMilestones(roadmap) {
  const raw = normalizeSkills(roadmap?.milestones || "");
  const titles = raw.length ? raw : MILESTONE_LIBRARY.map((m) => m.title);
  return titles.map((title, index) => {
    const meta = enrichMilestone(title);
    const cumulativeWeeks = titles.slice(0, index + 1).reduce(
      (sum, t) => sum + (enrichMilestone(t).weeks || 2),
      0,
    );
    return {
      id: `${index}-${meta.title}`,
      index,
      title: meta.title,
      icon: meta.icon,
      weeks: meta.weeks,
      difficulty: meta.difficulty,
      description: meta.description,
      skills: meta.skills,
      resources: meta.resources,
      project: meta.project,
      tasks: meta.tasks,
      cumulativeWeeks,
    };
  });
}

export function milestoneStatus(index, total, progressPercent) {
  const progress = clamp(Number(progressPercent || 0), 0, 100);
  const completed = Math.round((total * progress) / 100);
  if (index < completed) return "completed";
  if (index === completed) return "current";
  return index === completed + 1 ? "upcoming" : "locked";
}

/** Estimated weeks remaining to reach the career goal. */
export function estimateWeeksLeft(milestones, progressPercent) {
  if (!milestones.length) return 14;
  const progress = clamp(Number(progressPercent || 0), 0, 100);
  const done = Math.round((milestones.length * progress) / 100);
  const remaining = milestones.slice(done);
  const weeks = remaining.reduce((sum, m) => sum + (m.weeks || 2), 0);
  return Math.max(1, weeks);
}

/** Derive a human skill level from overall progress. */
export function deriveSkillLevel(progressPercent) {
  const p = clamp(Number(progressPercent || 0), 0, 100);
  if (p >= 85) return "Expert";
  if (p >= 60) return "Advanced";
  if (p >= 30) return "Intermediate";
  if (p > 0) return "Beginner";
  return "Getting Started";
}

/* ==========================================================================
   Stat cards
   ========================================================================== */

export function buildStats({
  roadmaps,
  bookings,
  certifications,
  projectsCompleted = 0,
}) {
  const { upcoming, completed, totalHours } = buildBookingStats(bookings);
  const streak = computeStreak(bookings);
  const overall =
    roadmaps.length
      ? Math.round(
          roadmaps.reduce((s, r) => s + Number(r.progressPercent || 0), 0) /
            roadmaps.length,
        )
      : 0;
  const mastered = new Set(
    roadmaps.flatMap((r) =>
      normalizeSkills(r.milestones || "").map((s) => s.toLowerCase()),
    ),
  ).size;

  return [
    {
      key: "progress",
      label: "Overall Progress",
      value: `${overall}%`,
      icon: "route",
      color: "#0f766e",
      bg: "rgba(15,118,110,0.12)",
      trend: overall >= 50 ? "On track" : "Keep going",
      trendUp: overall >= 50,
      spark: overall,
    },
    {
      key: "streak",
      label: "Current Streak",
      value: `${streak}d`,
      icon: "local_fire_department",
      color: "#f59e0b",
      bg: "rgba(245,158,11,0.14)",
      trend: streak > 0 ? "Active" : "Start today",
      trendUp: streak > 0,
      spark: streak,
    },
    {
      key: "hours",
      label: "Learning Hours",
      value: `${totalHours}h`,
      icon: "schedule",
      color: "#3b82f6",
      bg: "rgba(59,130,246,0.12)",
      trend: totalHours >= 10 ? "Great pace" : "Building up",
      trendUp: totalHours >= 5,
      spark: Math.min(100, Math.round(totalHours * 4)),
    },
    {
      key: "completed",
      label: "Completed Sessions",
      value: String(completed.length),
      icon: "task_alt",
      color: "#10b981",
      bg: "rgba(16,185,129,0.12)",
      trend: completed.length >= 5 ? "Milestone hit" : "Almost there",
      trendUp: completed.length >= 3,
      spark: Math.min(100, completed.length * 12),
    },
    {
      key: "upcoming",
      label: "Upcoming Sessions",
      value: String(upcoming.length),
      icon: "event_available",
      color: "#8b5cf6",
      bg: "rgba(139,92,246,0.12)",
      trend: upcoming.length ? "Ready to learn" : "Book one",
      trendUp: upcoming.length > 0,
      spark: Math.min(100, upcoming.length * 20),
    },
    {
      key: "projects",
      label: "Projects Completed",
      value: String(projectsCompleted),
      icon: "construction",
      color: "#f43f5e",
      bg: "rgba(244,63,94,0.12)",
      trend: projectsCompleted ? "Ship more" : "Start first",
      trendUp: projectsCompleted > 0,
      spark: Math.min(100, projectsCompleted * 25),
    },
    {
      key: "certs",
      label: "Certificates Earned",
      value: String(certifications.length),
      icon: "workspace_premium",
      color: "#7c3aed",
      bg: "rgba(124,58,237,0.12)",
      trend: certifications.length ? "Impressive" : "Earn one",
      trendUp: certifications.length > 0,
      spark: Math.min(100, certifications.length * 33),
    },
    {
      key: "skills",
      label: "Skills Mastered",
      value: String(mastered),
      icon: "bolt",
      color: "#0ea5e9",
      bg: "rgba(14,165,233,0.12)",
      trend: mastered ? "Growing" : "Explore",
      trendUp: mastered > 0,
      spark: Math.min(100, mastered * 8),
    },
  ];
}

/* ==========================================================================
   Achievements
   ========================================================================== */

export function buildAchievements({
  streak,
  completedRoadmaps,
  certifications,
  totalHours,
  completedSessions,
  overallProgress,
}) {
  const items = [
    {
      icon: "🔥",
      label: "7 Day Streak",
      hint: "Learn 7 days in a row",
      unlocked: streak >= 7,
      progress: clamp(Math.round((streak / 7) * 100), 0, 100),
    },
    {
      icon: "🏆",
      label: "Java Master",
      hint: "Complete the core Java milestones",
      unlocked: overallProgress >= 40,
      progress: clamp(overallProgress, 0, 100),
    },
    {
      icon: "🚀",
      label: "Spring Boot Explorer",
      hint: "Reach the Spring Boot milestone",
      unlocked: overallProgress >= 30,
      progress: clamp(overallProgress, 0, 100),
    },
    {
      icon: "⭐",
      label: "Top Learner",
      hint: "Finish 25+ learning sessions",
      unlocked: completedSessions >= 25,
      progress: clamp(Math.round((completedSessions / 25) * 100), 0, 100),
    },
    {
      icon: "💯",
      label: "Roadmap Conqueror",
      hint: "Complete your first roadmap",
      unlocked: completedRoadmaps > 0,
      progress: completedRoadmaps > 0 ? 100 : clamp(overallProgress, 0, 100),
    },
    {
      icon: "🎯",
      label: "25 Sessions Finisher",
      hint: "Attend 25 mentor sessions",
      unlocked: completedSessions >= 25,
      progress: clamp(Math.round((completedSessions / 25) * 100), 0, 100),
    },
    {
      icon: "🎓",
      label: "Certified Learner",
      hint: "Earn a Mentorly certificate",
      unlocked: certifications.length > 0,
      progress: certifications.length > 0 ? 100 : 0,
    },
    {
      icon: "⏱️",
      label: "10+ Hours Club",
      hint: "Accumulate 10 learning hours",
      unlocked: totalHours >= 10,
      progress: clamp(Math.round((totalHours / 10) * 100), 0, 100),
    },
  ];
  return {
    all: items,
    earned: items.filter((i) => i.unlocked),
    locked: items.filter((i) => !i.unlocked),
  };
}

/* ==========================================================================
   Weekly analytics
   ========================================================================== */

export function buildWeeklySeries(bookings) {
  const today = new Date();
  const days = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const dayBookings = (bookings || EMPTY_ARRAY).filter(
      (b) => dayKey(b?.session?.startTime) === key,
    );
    const totalMin = dayBookings.reduce((sum, b) => {
      const s = new Date(b?.session?.startTime || 0).getTime();
      const e = new Date(b?.session?.endTime || 0).getTime();
      if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return sum;
      return sum + (e - s) / 60000;
    }, 0);
    days.push({
      label: d.toLocaleDateString(undefined, { weekday: "short" }),
      date: key,
      hours: Math.round((totalMin / 60) * 10) / 10,
      sessions: dayBookings.length,
      isToday: i === 0,
    });
  }
  return days;
}

export function buildCalendarEvents(bookings) {
  const now = new Date();
  const weekFromNow = new Date(now.getTime() + 7 * 86400000);
  return (bookings || EMPTY_ARRAY)
    .filter((b) => {
      const t = new Date(b?.session?.startTime || 0);
      return Number.isFinite(t.getTime()) && t >= now && t <= weekFromNow;
    })
    .sort((a, b) => new Date(a.session.startTime) - new Date(b.session.startTime))
    .map((b) => {
      const session = b?.session || {};
      const mentor = session?.mentor || {};
      return {
        id: b.id,
        type: "session",
        title: session.title || "Mentor session",
        sub: mentor.fullName || "Mentor",
        startTime: session.startTime,
        endTime: session.endTime,
        meetingLink: session.meetingLink,
        icon: "videocam",
      };
    });
}

/* ==========================================================================
   Career readiness (derived scores with graceful fallbacks)
   ========================================================================== */

export function deriveCareerReadiness({
  profile,
  bookings,
  roadmaps,
  certifications,
  mentors,
}) {
  const { completed, totalHours } = buildBookingStats(bookings);
  const profileCompletion = clamp(
    Number(profile?.profileCompletionPercent || 0),
    0,
    100,
  );
  const hasGithub = Boolean(profile?.githubUrl);
  const hasLinkedin = Boolean(profile?.linkedinUrl);
  const hasPortfolio = Boolean(profile?.portfolioUrl);
  const overall =
    roadmaps.length
      ? Math.round(
          roadmaps.reduce((s, r) => s + Number(r.progressPercent || 0), 0) /
            roadmaps.length,
        )
      : 0;

  const interview = clamp(
    Math.round(
      profileCompletion * 0.4 + Math.min(completed.length * 4, 30) + overall * 0.3,
    ),
    0,
    100,
  );
  const resume = clamp(Math.round(profileCompletion * 0.7 + (hasLinkedin ? 15 : 0)), 0, 100);
  const portfolio = clamp(
    Math.round(profileCompletion * 0.4 + (hasPortfolio ? 30 : 0) + (certifications.length ? 20 : 0)),
    0,
    100,
  );
  const github = clamp(
    Math.round(profileCompletion * 0.3 + (hasGithub ? 35 : 0) + Math.min(completed.length * 3, 20)),
    0,
    100,
  );
  const mockInterviews = clamp(Math.min(completed.length * 12, 60) + overall * 0.3, 0, 100);
  const coding = clamp(overall * 0.7 + Math.min(completed.length * 2, 20), 0, 100);
  const communication = clamp(profileCompletion * 0.5 + Math.min(mentors.length * 4, 30), 0, 100);
  const jobReadiness = clamp(
    Math.round(
      interview * 0.25 +
        resume * 0.2 +
        portfolio * 0.15 +
        github * 0.15 +
        coding * 0.15 +
        communication * 0.1,
    ),
    0,
    100,
  );

  return {
    jobReadiness,
    interview,
    resume,
    portfolio,
    github,
    mockInterviews,
    coding,
    communication,
    overallReadiness: Math.round((jobReadiness + overall) / 2),
    hours: Math.round(totalHours),
  };
}

/* ==========================================================================
   Project recommendations
   ========================================================================== */

const PROJECT_CATALOG = [
  {
    title: "Todo App",
    description:
      "A clean CRUD API with validation, error handling and tests — the classic first backend build.",
    difficulty: "Beginner",
    icon: "checklist",
    technologies: ["Java", "Spring Boot", "H2"],
    hours: 8,
    steps: ["Design model + API", "Implement endpoints", "Write tests"],
    gradient: "linear-gradient(135deg,#0f766e,#14b8a6)",
  },
  {
    title: "Library Management",
    description:
      "Books, members and loans with JPA relationships and paginated queries.",
    difficulty: "Beginner",
    icon: "menu_book",
    technologies: ["JPA", "Hibernate", "H2"],
    hours: 12,
    steps: ["Schema design", "Map entities", "Add pagination"],
    gradient: "linear-gradient(135deg,#1d4ed8,#3b82f6)",
  },
  {
    title: "Blog API",
    description:
      "Posts, comments and tags with Spring Security, validation and OpenAPI docs.",
    difficulty: "Intermediate",
    icon: "article",
    technologies: ["Spring Boot", "Spring Security", "MySQL"],
    hours: 20,
    steps: ["Resource modeling", "Auth + roles", "OpenAPI docs"],
    gradient: "linear-gradient(135deg,#7c3aed,#a78bfa)",
  },
  {
    title: "E-Commerce Backend",
    description:
      "Products, carts, orders and payments with secure APIs and admin flows.",
    difficulty: "Advanced",
    icon: "storefront",
    technologies: ["Spring Boot", "JWT", "Stripe"],
    hours: 32,
    steps: ["Domain model", "Payment flow", "Admin dashboard"],
    gradient: "linear-gradient(135deg,#b45309,#f59e0b)",
  },
  {
    title: "Microservices Project",
    description:
      "Split services with Docker Compose, a gateway and resilient communication.",
    difficulty: "Advanced",
    icon: "account_tree",
    technologies: ["Spring Cloud", "Docker", "Kafka"],
    hours: 40,
    steps: ["Service boundaries", "Gateway + discovery", "Containerize"],
    gradient: "linear-gradient(135deg,#0369a1,#38bdf8)",
  },
];

export function buildProjects(overallProgress) {
  const p = clamp(Number(overallProgress || 0), 0, 100);
  const unlockedCount = Math.max(1, Math.min(PROJECT_CATALOG.length, Math.ceil((p / 100) * PROJECT_CATALOG.length) + 1));
  return PROJECT_CATALOG.map((project, index) => ({
    ...project,
    unlocked: index < unlockedCount,
    recommended: index === unlockedCount - 1 || index === 0,
  }));
}

/* ==========================================================================
   AI assistant insights (rule-based, graceful)
   ========================================================================== */

export function deriveAiInsights({
  milestones,
  bookings,
  certifications,
}) {
  const current = milestones.find((m) => m.status === "current");
  const completedList = milestones.filter((m) => m.status === "completed");
  const next = milestones.find((m) => m.status === "upcoming") || milestones.find((m) => m.status === "locked");
  const completedTitles = completedList.map((m) => m.title);
  const { upcoming, totalHours } = buildBookingStats(bookings);

  let focus = "Start your first milestone and book a mentor session to accelerate.";
  if (current) {
    focus = `You should now focus on ${current.title} before learning ${next ? next.title : "the next milestone"}.`;
  }
  const weak = milestones
    .filter((m) => m.status !== "completed")
    .slice(0, 2)
    .map((m) => m.title);
  const strong = completedTitles.slice(-2);
  const practice = current ? current.tasks : ["Book your first session", "Explore a starter skill"];
  const sessionHint =
    upcoming.length > 0
      ? `${upcoming.length} session${upcoming.length > 1 ? "s" : ""} coming up — come prepared with questions.`
      : "No sessions booked — book a mentor to keep momentum going.";
  const estDaily = Math.max(1, Math.min(3, Math.round((totalHours || 4) / 4)));
  const motivation =
    totalHours >= 10
      ? "Your consistency is paying off. Keep a steady pace and the results will follow."
      : strong.length
        ? `Your ${strong.join(" and ")} fundamentals are looking solid — build on them.`
        : "Every expert was once a beginner. The best time to start is today.";

  return {
    focus,
    weakAreas: weak.length ? weak : [milestones[0]?.title || "Java Basics"],
    strongAreas: strong,
    suggestedPractice: practice.slice(0, 3),
    sessionHint,
    estDailyHours: estDaily,
    motivation,
    certifications: certifications.length,
    skillCount: milestones.length,
  };
}

/* ==========================================================================
   Certificates (earned + locked/upcoming derived from roadmap)
   ========================================================================== */

export function buildCertificates(certifications, milestones, overallProgress) {
  const earned = (certifications || EMPTY_ARRAY).map((c) => ({
    id: c.id || c.certificateId,
    title: c.title || "Certificate",
    issuedAt: c.issuedAt,
    certificateId: c.certificateId,
    issuedBy: c.mentorName || c.issuedBy || "Mentorly",
  }));
  const locked = milestones
    .filter((m) => m.status !== "completed")
    .slice(0, 3)
    .map((m) => ({ title: `${m.title} Certificate`, status: "locked" }));
  const upcoming = milestones
    .filter((m) => m.status === "upcoming")
    .slice(0, 2)
    .map((m) => ({ title: `${m.title} Certificate`, status: "upcoming" }));
  return { earned, locked, upcoming, overallProgress };
}

/* ==========================================================================
   Community (graceful, derived)
   ========================================================================== */

export function deriveCommunity({ mentors, bookings }) {
  const { completed } = buildBookingStats(bookings);
  const peers = Math.max(3, mentors.length);
  return {
    peers,
    friendsLearning: Math.min(peers, 12),
    groups: ["Java Backend Developers", "Spring Boot Study Circle", "Coding Interview Prep"],
    studyPartners: mentors.slice(0, 3),
    challenges: [
      { title: "7-day streak sprint", reward: "250 XP", progress: clamp(Math.round((computeStreak(bookings) / 7) * 100), 0, 100) },
      { title: "Complete 5 sessions", reward: "300 XP", progress: clamp(Math.round((completed.length / 5) * 100), 0, 100) },
    ],
    rank: peers > 0 ? Math.min(peers, Math.max(1, Math.round(peers / 3))) : 1,
  };
}

/* ==========================================================================
   Resources catalog
   ========================================================================== */

/**
 * Curated learning resources. Every entry is a REAL, maintained external
 * link (official docs, official YouTube courses, public cheat sheets).
 * Items are rendered as new-tab links — never as fake/placeholder text.
 *
 * The "Interview Questions" category is intentionally absent: there is no
 * backend resource store, so we do not show made-up questions.
 */
export const RESOURCE_CATALOG = [
  {
    icon: "menu_book",
    title: "Books",
    color: "#7c3aed",
    blurb: "Official & public programming books that open in your browser",
    items: [
      { title: "Oracle Java Tutorials", url: "https://docs.oracle.com/javase/tutorial/" },
      { title: "Spring Framework Reference", url: "https://docs.spring.io/spring-framework/reference/" },
      { title: "React Documentation", url: "https://react.dev/" },
      { title: "MDN Web Docs", url: "https://developer.mozilla.org/" },
      { title: "PostgreSQL Documentation", url: "https://www.postgresql.org/docs/" },
      { title: "Docker Documentation", url: "https://docs.docker.com/" },
      { title: "Kubernetes Documentation", url: "https://kubernetes.io/docs/" },
    ],
    action: "Browse books",
  },
  {
    icon: "article",
    title: "Articles",
    color: "#0ea5e9",
    blurb: "Real engineering articles from trusted publishers",
    items: [
      { title: "Baeldung — Spring Boot", url: "https://www.baeldung.com/spring-boot" },
      { title: "freeCodeCamp News", url: "https://www.freecodecamp.org/news/" },
      { title: "GeeksforGeeks — Java", url: "https://www.geeksforgeeks.org/java/" },
      { title: "Dev.to — Java", url: "https://dev.to/t/java" },
      { title: "Official Spring Blog", url: "https://spring.io/blog" },
      { title: "MDN — JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
    ],
    action: "Read articles",
  },
  {
    icon: "play_circle",
    title: "Videos",
    color: "#f43f5e",
    blurb: "Official YouTube courses — opens on YouTube in a new tab",
    items: [
      { title: "Java Full Course for Beginners (Programming with Mosh)", url: "https://www.youtube.com/watch?v=eIrMbAQSU34" },
      { title: "Spring Boot Full Course (Amigoscode)", url: "https://www.youtube.com/watch?v=9SGDpanrc8U" },
      { title: "React Crash Course (freeCodeCamp)", url: "https://www.youtube.com/watch?v=bMknfKXIFA8" },
      { title: "System Design Basics (Gaurav Sen)", url: "https://www.youtube.com/watch?v=xpDnVSmNFX0" },
    ],
    action: "Watch videos",
  },
  {
    icon: "description",
    title: "Official Docs",
    color: "#0f766e",
    blurb: "The authoritative reference for every major technology",
    items: [
      { title: "Java — Oracle Docs", url: "https://docs.oracle.com/en/java/" },
      { title: "Spring Boot Reference", url: "https://docs.spring.io/spring-boot/reference/" },
      { title: "Spring Security Reference", url: "https://docs.spring.io/spring-security/reference/" },
      { title: "React Docs", url: "https://react.dev/" },
      { title: "Node.js Docs", url: "https://nodejs.org/docs/latest/api/" },
      { title: "Docker Docs", url: "https://docs.docker.com/" },
      { title: "Git Docs", url: "https://git-scm.com/doc" },
      { title: "PostgreSQL Docs", url: "https://www.postgresql.org/docs/" },
      { title: "MongoDB Docs", url: "https://www.mongodb.com/docs/" },
      { title: "Redis Docs", url: "https://redis.io/docs/" },
      { title: "JWT Introduction", url: "https://jwt.io/introduction" },
      { title: "REST API — MDN", url: "https://developer.mozilla.org/en-US/docs/Glossary/REST" },
    ],
    action: "Open docs",
  },
  {
    icon: "bolt",
    title: "Cheat Sheets",
    color: "#f59e0b",
    blurb: "Real quick-reference PDFs & cards hosted by trusted projects",
    items: [
      { title: "Git Cheat Sheet (GitHub PDF)", url: "https://training.github.com/downloads/github-git-cheat-sheet.pdf" },
      { title: "SQL Cheat Sheet (LearnSQL)", url: "https://learnsql.com/blog/sql-basics-cheat-sheet/" },
      { title: "Docker Cheat Sheet (Docker Docs)", url: "https://docs.docker.com/get-started/docker_cheatsheet.pdf" },
      { title: "Linux Command Line (freeCodeCamp)", url: "https://www.freecodecamp.org/news/the-linux-commands-handbook/" },
      { title: "React Cheat Sheet (React Docs)", url: "https://react.dev/learn" },
    ],
    action: "View cheat sheets",
  },
];
