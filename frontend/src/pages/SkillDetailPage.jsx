import { useMemo, useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

/* ── Skill detail data ── */

const SKILL_DETAILS = {
  java: {
    name: "Java",
    category: "Backend",
    difficulty: "intermediate",
    duration: "8-16 weeks",
    description: "Build enterprise-grade applications with Java, one of the most versatile and widely-used programming languages in the world. Java powers everything from Android apps to large-scale backend systems.",
    whatYouLearn: ["Java syntax & fundamentals", "Object-Oriented Programming", "Collections Framework", "Exception Handling", "File I/O & Serialization", "Multithreading & Concurrency", "JDBC & Database Access", "Spring Boot & REST APIs"],
    prerequisites: ["Basic programming logic", "Understanding of variables & loops", "Familiarity with any programming language"],
    careerPaths: ["Backend Developer", "Android Developer", "Full Stack Developer"],
    avgSalary: "₹6-25 LPA",
    roadmapId: "java-developer",
    docUrl: "https://docs.oracle.com/en/java/",
    youtubeUrl: "https://www.youtube.com/results?search_query=java+programming+course",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/java",
    interviewUrl: "https://www.geeksforgeeks.org/java-interview-questions/",
    mentors: [
      { id: "sample-1", fullName: "Priya Sharma", company: "Google", skills: ["Java", "Spring Boot", "Microservices"], averageRating: 4.8, totalSessions: 340 },
    ],
  },
  react: {
    name: "React",
    category: "Frontend",
    difficulty: "beginner",
    duration: "6-12 weeks",
    description: "Master React to build fast, interactive user interfaces. The most popular frontend library for modern web apps, used by companies like Facebook, Netflix, and Airbnb.",
    whatYouLearn: ["JSX & Components", "State & Props", "Hooks (useState, useEffect)", "Event Handling", "Conditional Rendering", "Lists & Keys", "Forms & Controlled Inputs", "React Router", "State Management (Context/Redux)"],
    prerequisites: ["HTML & CSS basics", "JavaScript fundamentals (ES6+)", "Understanding of DOM"],
    careerPaths: ["Frontend Developer", "UI Developer", "Full Stack Developer"],
    avgSalary: "₹6-18 LPA",
    roadmapId: "frontend-developer",
    docUrl: "https://react.dev/",
    youtubeUrl: "https://www.youtube.com/results?search_query=react+js+course",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/react",
    interviewUrl: "https://www.interviewbit.com/react-interview-questions/",
    mentors: [
      { id: "sample-2", fullName: "Rahul Verma", company: "Microsoft", skills: ["React", "TypeScript", "Next.js"], averageRating: 4.6, totalSessions: 280 },
    ],
  },
  "spring-boot": {
    name: "Spring Boot",
    category: "Backend",
    difficulty: "intermediate",
    duration: "8-16 weeks",
    description: "Create production-grade Spring-based applications with minimal fuss. The go-to framework for Java microservices and cloud-native applications.",
    whatYouLearn: ["Spring Boot Basics", "Dependency Injection", "REST API Development", "Spring Data JPA", "Security with Spring Security", "Microservices Architecture", "Testing with JUnit & Mockito", "Deployment & Monitoring"],
    prerequisites: ["Java fundamentals", "Understanding of OOP", "Basic SQL knowledge"],
    careerPaths: ["Backend Developer", "Java Developer", "Microservices Developer"],
    avgSalary: "₹8-22 LPA",
    roadmapId: "java-developer",
    docUrl: "https://spring.io/projects/spring-boot",
    youtubeUrl: "https://www.youtube.com/results?search_query=spring+boot+course",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/spring-boot",
    interviewUrl: "https://www.javatpoint.com/spring-boot-interview-questions",
    mentors: [
      { id: "sample-1", fullName: "Priya Sharma", company: "Google", skills: ["Java", "Spring Boot", "Microservices"], averageRating: 4.8, totalSessions: 340 },
    ],
  },
  python: {
    name: "Python",
    category: "AI / Machine Learning",
    difficulty: "beginner",
    duration: "4-10 weeks",
    description: "Learn Python programming from scratch. The most beginner-friendly language powering AI, data science, automation, and web development.",
    whatYouLearn: ["Python Basics & Syntax", "Data Structures (Lists, Dicts, Sets)", "Functions & Modules", "File Handling", "OOP in Python", "Libraries (NumPy, Pandas)", "APIs & Web Scraping", "Basic ML with Scikit-learn"],
    prerequisites: ["No programming experience needed"],
    careerPaths: ["Python Developer", "Data Scientist", "AI Engineer"],
    avgSalary: "₹5-20 LPA",
    roadmapId: "python-developer",
    docUrl: "https://docs.python.org/3/",
    youtubeUrl: "https://www.youtube.com/results?search_query=python+course+for+beginners",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/python",
    interviewUrl: "https://www.geeksforgeeks.org/python-interview-questions/",
    mentors: [],
  },
  "node.js": {
    name: "Node.js",
    category: "Backend",
    difficulty: "intermediate",
    duration: "6-12 weeks",
    description: "Build scalable server-side applications with JavaScript. Event-driven architecture for modern backends and real-time applications.",
    whatYouLearn: ["Node.js Runtime & NPM", "Express.js Framework", "RESTful APIs", "Database Integration (MongoDB, SQL)", "Authentication & Authorization", "File System & Streams", "WebSockets & Real-time", "Testing & Deployment"],
    prerequisites: ["JavaScript fundamentals (ES6+)", "Basic understanding of web servers"],
    careerPaths: ["Backend Developer", "Full Stack Developer", "API Developer"],
    avgSalary: "₹6-18 LPA",
    roadmapId: "fullstack-developer",
    docUrl: "https://nodejs.org/docs/latest/api/",
    youtubeUrl: "https://www.youtube.com/results?search_query=node+js+course",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/nodejs",
    interviewUrl: "https://www.interviewbit.com/node-js-interview-questions/",
    mentors: [],
  },
  aws: {
    name: "AWS",
    category: "Cloud Computing",
    difficulty: "advanced",
    duration: "12-24 weeks",
    description: "Master Amazon Web Services — the world's leading cloud platform. From EC2 to Lambda, learn to deploy and scale applications in the cloud.",
    whatYouLearn: ["AWS Core Services (EC2, S3, RDS)", "Lambda & Serverless", "API Gateway", "DynamoDB", "CloudFormation & IaC", "CI/CD with CodePipeline", "Monitoring with CloudWatch", "Security & IAM"],
    prerequisites: ["Basic understanding of cloud computing", "Command line familiarity", "Networking basics"],
    careerPaths: ["Cloud Engineer", "DevOps Engineer", "Solutions Architect"],
    avgSalary: "₹10-30 LPA",
    roadmapId: "cloud-engineer",
    docUrl: "https://docs.aws.amazon.com/",
    youtubeUrl: "https://www.youtube.com/results?search_query=aws+course",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/aws",
    interviewUrl: "https://www.javatpoint.com/aws-interview-questions",
    mentors: [
      { id: "sample-3", fullName: "Aisha Kapoor", company: "Amazon", skills: ["AWS", "Docker", "Kubernetes"], averageRating: 4.7, totalSessions: 195 },
    ],
  },
  docker: {
    name: "Docker",
    category: "DevOps",
    difficulty: "intermediate",
    duration: "4-8 weeks",
    description: "Containerise your applications with Docker. Simplify deployment, scaling, and environment consistency across development and production.",
    whatYouLearn: ["Docker Basics & Architecture", "Images & Containers", "Dockerfile & Building", "Docker Compose", "Networking & Volumes", "Registry & Hub", "Docker Swarm", "CI/CD with Docker"],
    prerequisites: ["Command line basics", "Understanding of Linux", "Basic networking"],
    careerPaths: ["DevOps Engineer", "Platform Engineer", "Cloud Engineer"],
    avgSalary: "₹8-25 LPA",
    roadmapId: "devops-engineer",
    docUrl: "https://docs.docker.com/",
    youtubeUrl: "https://www.youtube.com/results?search_query=docker+course",
    practiceUrl: "https://leetcode.com/problemset/",
    githubUrl: "https://github.com/topics/docker",
    interviewUrl: "https://www.edureka.co/blog/interview-questions/docker-interview-questions/",
    mentors: [],
  },
  sql: {
    name: "SQL",
    category: "Data Science",
    difficulty: "beginner",
    duration: "3-6 weeks",
    description: "Query and manage relational databases with SQL. An essential skill for every developer and data professional — from backend engineers to data analysts.",
    whatYouLearn: ["SELECT, INSERT, UPDATE, DELETE", "JOINs & Subqueries", "Aggregation & Grouping", "Indexes & Performance", "Normalization & Schema Design", "Transactions & ACID", "Stored Procedures", "Views & CTEs"],
    prerequisites: ["No programming experience needed", "Basic logical thinking"],
    careerPaths: ["Data Analyst", "Backend Developer", "Database Administrator"],
    avgSalary: "₹4-15 LPA",
    roadmapId: "data-analyst",
    docUrl: "https://www.w3schools.com/sql/",
    youtubeUrl: "https://www.youtube.com/results?search_query=sql+course+for+beginners",
    practiceUrl: "https://leetcode.com/problemset/database/",
    githubUrl: "https://github.com/topics/sql",
    interviewUrl: "https://www.interviewbit.com/sql-interview-questions/",
    mentors: [],
  },
};

const DIFFICULTY_META = {
  beginner: { label: "Beginner", icon: "signal_cellular_0_bar", color: "#16A34A", bg: "rgba(22,163,74,0.10)" },
  intermediate: { label: "Intermediate", icon: "signal_cellular_2_bar", color: "#F59E0B", bg: "rgba(245,158,11,0.10)" },
  advanced: { label: "Advanced", icon: "signal_cellular_4_bar", color: "#EF4444", bg: "rgba(239,68,68,0.10)" },
};

function initials(val) {
  return String(val || "?")
    .split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default function SkillDetailPage() {
  const { skillId } = useParams();
  const skill = SKILL_DETAILS[skillId?.toLowerCase()];

  useEffect(() => {
    document.title = `${skill?.name || "Skill Details"} | SkillSwap`;
  }, [skill]);

  if (!skill) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        <div className="md-empty" style={{ margin: "60px auto", maxWidth: 420 }}>
          <div className="md-empty__icon">
            <span className="material-symbols-outlined">search_off</span>
          </div>
          <h3 className="md-empty__title">Skill not found</h3>
          <p className="md-empty__desc">The skill you're looking for doesn't exist or hasn't been added yet.</p>
          <Link to="/learner/skills" className="mp-btn mp-btn--primary">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Back to Explore Skills
          </Link>
        </div>
      </div>
    );
  }

  const diff = DIFFICULTY_META[skill.difficulty] || DIFFICULTY_META.beginner;

  return (
    <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: "0.85rem", color: "var(--mp-text-secondary)" }}>
        <Link to="/learner/skills" style={{ color: "var(--mp-primary)", textDecoration: "none" }}>Explore Skills</Link>
        <Icon name="chevron_right" style={{ fontSize: 16 }} />
        <span>{skill.name}</span>
      </div>

      {/* Header */}
      <div className="mp-hero" style={{ marginBottom: 24 }}>
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>{skill.category === "Backend" ? "dns" : "code"}</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_stories</span>
            {skill.category}
          </div>
          <h1>{skill.name}</h1>
          <p className="mp-hero__sub">{skill.description}</p>
          <div className="mp-hero__actions" style={{ gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: diff.bg, color: diff.color, fontSize: "0.8rem", fontWeight: 700 }}>
              <Icon name={diff.icon} /> {diff.label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>
              <Icon name="schedule" /> {skill.duration}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>
              <Icon name="currency_rupee" /> {skill.avgSalary}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* ── Main Content ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>

          {/* What You Will Learn */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="school" style={{ color: "var(--mp-primary)" }} /> What You Will Learn
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {skill.whatYouLearn.map((item) => (
                <div key={item} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--mp-primary-lighter)", fontSize: "0.88rem" }}>
                  <Icon name="check_circle" style={{ color: "var(--mp-success)", fontSize: 18 }} />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Prerequisites */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="playlist_add_check" style={{ color: "var(--mp-warning)" }} /> Prerequisites
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {skill.prerequisites.map((p) => (
                <div key={p} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--mp-warning-light)", fontSize: "0.88rem" }}>
                  <Icon name="arrow_forward" style={{ fontSize: 16, color: "var(--mp-warning)" }} />
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Career Paths */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="work" style={{ color: "var(--mp-purple)" }} /> Career Opportunities
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {skill.careerPaths.map((cp) => (
                <Link
                  key={cp}
                  to={`/learner/careers/${cp.toLowerCase().replace(/\s+/g, "-")}`}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 999, background: "var(--mp-purple-light)", color: "var(--mp-purple)", fontSize: "0.85rem", fontWeight: 700, textDecoration: "none", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--mp-purple)"; e.currentTarget.style.color = "#fff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--mp-purple-light)"; e.currentTarget.style.color = "var(--mp-purple)"; }}
                >
                  <Icon name="arrow_forward" style={{ fontSize: 16 }} /> {cp}
                </Link>
              ))}
            </div>
          </div>

          {/* Learning Roadmap */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="route" style={{ color: "var(--mp-primary)" }} /> Learning Roadmap
            </h3>
            <p style={{ margin: "0 0 16px", color: "var(--mp-text-secondary)", fontSize: "0.9rem" }}>
              Follow this structured path to master {skill.name}. Click "View Full Roadmap" for a detailed learning plan with milestones and projects.
            </p>
            <Link to={`/learner/roadmaps/${skill.roadmapId}`} className="mp-btn mp-btn--primary" style={{ textDecoration: "none" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>route</span>
              View Full Roadmap
            </Link>
          </div>

          {/* Learning Resources */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="menu_book" style={{ color: "var(--mp-info)" }} /> Learning Resources
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[
                { label: "Official Documentation", icon: "menu_book", color: "#0F9D8A", url: skill.docUrl },
                { label: "YouTube Courses", icon: "play_circle", color: "#EF4444", url: skill.youtubeUrl },
                { label: "Practice Problems", icon: "quiz", color: "#8B5CF6", url: skill.practiceUrl },
                { label: "GitHub Repositories", icon: "inventory_2", color: "#1F2937", url: skill.githubUrl },
                { label: "Interview Preparation", icon: "work_history", color: "#EC4899", url: skill.interviewUrl },
              ].map((r) => (
                <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: "1px solid var(--mp-card-border)", textDecoration: "none", color: "var(--mp-text)", transition: "all 0.15s", fontSize: "0.88rem", fontWeight: 600 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = r.color; e.currentTarget.style.background = `${r.color}08`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--mp-card-border)"; e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: "#fff", background: r.color, fontSize: "1rem" }}>
                    <Icon name={r.icon} />
                  </span>
                  {r.label}
                  <Icon name="open_in_new" style={{ marginLeft: "auto", fontSize: 16, color: "var(--mp-text-muted)" }} />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sidebar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
          {/* Quick Info */}
          <div className="mp-stat" style={{ padding: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--mp-text-secondary)" }}>Quick Info</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--mp-text-muted)" }}>Category</span>
                <span style={{ fontWeight: 700 }}>{skill.category}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--mp-text-muted)" }}>Difficulty</span>
                <span style={{ fontWeight: 700, color: diff.color }}>{diff.label}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--mp-text-muted)" }}>Duration</span>
                <span style={{ fontWeight: 700 }}>{skill.duration}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--mp-text-muted)" }}>Avg. Salary</span>
                <span style={{ fontWeight: 700, color: "var(--mp-success)" }}>{skill.avgSalary}</span>
              </div>
            </div>
          </div>

          {/* Find Mentor */}
          <Link to={`/learner/mentors?skill=${encodeURIComponent(skill.name)}`}
            className="mp-btn mp-btn--primary"
            style={{ textDecoration: "none", justifyContent: "center", padding: "14px 20px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_search</span>
            Find {skill.name} Mentors
          </Link>
        </div>
      </div>

      {/* ── Recommended Mentors ── */}
      {skill.mentors.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="sk-section__head">
            <h2 className="sk-section__title"><Icon name="groups" /> {skill.name} Mentors</h2>
            <Link to={`/learner/mentors?skill=${encodeURIComponent(skill.name)}`} className="sk-section__link">
              Browse All <Icon name="arrow_forward" />
            </Link>
          </div>
          <div className="sk-mentor-grid--catalog">
            {skill.mentors.map((m) => (
              <div key={m.id} className="sk-mentor--catalog md-animate">
                <div className="sk-mentor--catalog__avatar">
                  <span>{initials(m.fullName)}</span>
                </div>
                <div className="sk-mentor--catalog__body">
                  <strong className="sk-mentor--catalog__name">{m.fullName}</strong>
                  {m.company && <span className="sk-mentor--catalog__company">{m.company}</span>}
                  <div className="sk-mentor--catalog__rating">
                    <Icon name="star" />
                    <span>{m.averageRating > 0 ? m.averageRating.toFixed(1) : "—"}</span>
                    <span className="sk-mentor--catalog__sessions">{m.totalSessions} sessions</span>
                  </div>
                  <div className="sk-mentor--catalog__skills">
                    {m.skills.slice(0, 3).map((s) => <span key={s}>{s}</span>)}
                  </div>
                </div>
                <div className="sk-mentor--catalog__actions">
                  <Link to={`/mentors/${m.id}`} className="sk-btn sk-btn--primary sk-btn--sm" style={{ flex: 1 }}>
                    <Icon name="person" /> View Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* No mentors state */}
      {skill.mentors.length === 0 && (
        <div style={{ marginTop: 32, padding: 32, borderRadius: 16, border: "1px solid var(--mp-card-border)", textAlign: "center" }}>
          <Icon name="person_off" style={{ fontSize: 40, color: "var(--mp-text-muted)", marginBottom: 12 }} />
          <h3 style={{ margin: "0 0 8px" }}>No mentors currently teach {skill.name}.</h3>
          <p style={{ margin: "0 0 16px", color: "var(--mp-text-secondary)" }}>We're still onboarding mentors for this skill.</p>
          <Link to="/learner/skills" className="mp-btn mp-btn--primary" style={{ textDecoration: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_stories</span>
            Explore Other Skills
          </Link>
        </div>
      )}
    </div>
  );
}
