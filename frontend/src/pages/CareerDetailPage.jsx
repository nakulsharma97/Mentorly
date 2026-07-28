import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Icon from "../modules/common/dashboard/Icon";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

const CAREERS = {
  "backend-developer": {
    title: "Backend Developer",
    icon: "dns",
    color: "#0F9D8A",
    salary: "₹8-20 LPA",
    experience: "1-3 years",
    oversight: "Backend developers build and maintain the server-side logic, databases, and APIs that power web and mobile applications. They ensure systems are scalable, secure, and performant.",
    responsibilities: [
      "Design and implement RESTful APIs",
      "Manage databases and data storage solutions",
      "Implement authentication and authorization",
      "Write clean, maintainable, and testable code",
      "Optimize application for performance and scalability",
      "Collaborate with frontend developers and product teams",
      "Set up CI/CD pipelines and monitoring",
      "Troubleshoot and debug production issues",
    ],
    requiredSkills: ["Java / Python / Node.js", "Spring Boot / Django / Express", "SQL & NoSQL Databases", "REST API Design", "Git & Version Control", "Docker & Containerization", "Cloud Services (AWS/GCP/Azure)", "CI/CD & DevOps Practices"],
    learningRoadmaps: [
      { label: "Java Developer Roadmap", id: "java-developer" },
      { label: "Python Developer Roadmap", id: "python-developer" },
    ],
    companiesHiring: ["Google", "Microsoft", "Amazon", "Flipkart", "Swiggy", "Razorpay"],
    skillsForMentors: ["Java", "Spring Boot", "Node.js", "Python"],
  },
  "frontend-developer": {
    title: "Frontend Developer",
    icon: "web",
    color: "#3B82F6",
    salary: "₹6-18 LPA",
    experience: "1-3 years",
    oversight: "Frontend developers create the user interface and experience of web applications. They bridge design and technology to build responsive, accessible, and performant user-facing features.",
    responsibilities: [
      "Build responsive web interfaces using HTML, CSS, JavaScript",
      "Develop reusable components with React/Vue/Angular",
      "Implement state management and routing",
      "Ensure cross-browser compatibility and accessibility",
      "Optimize frontend performance (lazy loading, code splitting)",
      "Collaborate with designers on UI/UX implementation",
      "Write unit and integration tests",
      "Integrate with backend APIs",
    ],
    requiredSkills: ["HTML5 & CSS3", "JavaScript (ES6+)", "React / Vue / Angular", "TypeScript", "State Management (Redux/Zustand)", "Responsive Design", "Git & Version Control", "Testing (Jest, Cypress)"],
    learningRoadmaps: [
      { label: "Frontend Developer Roadmap", id: "frontend-developer" },
    ],
    companiesHiring: ["Google", "Microsoft", "Flipkart", "Zomato", "Urban Company", "Razorpay"],
    skillsForMentors: ["React", "JavaScript", "TypeScript", "CSS"],
  },
  "full-stack-developer": {
    title: "Full Stack Developer",
    icon: "code",
    color: "#8B5CF6",
    salary: "₹10-25 LPA",
    experience: "2-5 years",
    oversight: "Full stack developers work on both frontend and backend technologies. They understand the entire web development lifecycle and can build complete applications end-to-end.",
    responsibilities: [
      "Develop both client-side and server-side code",
      "Design and implement database schemas",
      "Build responsive UIs and RESTful APIs",
      "Deploy and maintain applications",
      "Review code and mentor junior developers",
      "Participate in architecture decisions",
    ],
    requiredSkills: ["Frontend (React/Angular/Vue)", "Backend (Node.js/Python/Java)", "Databases (SQL & NoSQL)", "REST & GraphQL APIs", "Docker & Cloud", "Git & CI/CD"],
    learningRoadmaps: [
      { label: "Java Developer Roadmap", id: "java-developer" },
      { label: "Frontend Developer Roadmap", id: "frontend-developer" },
      { label: "Python Developer Roadmap", id: "python-developer" },
    ],
    companiesHiring: ["Google", "Microsoft", "Amazon", "Flipkart", "Swiggy", "Paytm"],
    skillsForMentors: ["React", "Node.js", "Java", "Python"],
  },
  "cloud-engineer": {
    title: "Cloud Engineer",
    icon: "cloud",
    color: "#EC4899",
    salary: "₹12-30 LPA",
    experience: "3-6 years",
    oversight: "Cloud engineers design, implement, and manage cloud infrastructure and services. They ensure systems are scalable, reliable, and cost-efficient on cloud platforms.",
    responsibilities: [
      "Design and deploy cloud infrastructure (AWS/Azure/GCP)",
      "Automate infrastructure with IaC (Terraform/CloudFormation)",
      "Implement monitoring, logging, and alerting",
      "Manage containerized applications (Docker, Kubernetes)",
      "Optimize cloud costs and resource utilization",
      "Ensure security and compliance",
      "Set up CI/CD pipelines",
    ],
    requiredSkills: ["AWS / Azure / GCP", "Terraform / CloudFormation", "Docker & Kubernetes", "Linux Administration", "Networking & Security", "CI/CD (Jenkins/GitHub Actions)", "Scripting (Python/Bash)"],
    learningRoadmaps: [
      { label: "Cloud Engineer Roadmap", id: "cloud-engineer" },
    ],
    companiesHiring: ["Amazon", "Google", "Microsoft", "Infosys", "TCS", "Wipro"],
    skillsForMentors: ["AWS", "Docker", "Kubernetes", "DevOps"],
  },
  "ai-engineer": {
    title: "AI Engineer",
    icon: "psychology",
    color: "#F59E0B",
    salary: "₹15-35 LPA",
    experience: "2-5 years",
    oversight: "AI engineers develop and deploy machine learning models and AI systems. They work on everything from data preprocessing to model training and production deployment.",
    responsibilities: [
      "Preprocess and analyze large datasets",
      "Design, train, and evaluate ML models",
      "Deploy models to production (MLOps)",
      "Build data pipelines and feature stores",
      "Monitor model performance and retrain",
      "Collaborate with data scientists and engineers",
      "Research and implement latest AI techniques",
    ],
    requiredSkills: ["Python", "TensorFlow / PyTorch", "Scikit-learn", "SQL & Data Manipulation", "MLOps (Docker, K8s)", "Statistics & Mathematics", "Cloud AI Services"],
    learningRoadmaps: [
      { label: "Python Developer Roadmap", id: "python-developer" },
    ],
    companiesHiring: ["Google", "Microsoft", "Amazon", "OpenAI (via partners)", "Flipkart", "Swiggy"],
    skillsForMentors: ["Python", "Machine Learning", "AI"],
  },
  "devops-engineer": {
    title: "DevOps Engineer",
    icon: "terminal",
    color: "#EF4444",
    salary: "₹10-28 LPA",
    experience: "2-5 years",
    oversight: "DevOps engineers bridge development and operations. They automate infrastructure, streamline deployment pipelines, and ensure system reliability and scalability.",
    responsibilities: [
      "Automate build, test, and deployment processes",
      "Manage CI/CD pipelines (Jenkins, GitHub Actions)",
      "Containerize applications (Docker) and orchestrate (K8s)",
      "Monitor system health and performance",
      "Manage cloud infrastructure as code",
      "Implement security best practices",
      "Collaborate with development teams",
    ],
    requiredSkills: ["Docker & Kubernetes", "CI/CD (Jenkins/GitHub Actions)", "Terraform / Ansible", "AWS / Azure / GCP", "Linux & Scripting", "Monitoring (Prometheus/Grafana)", "Git & Version Control"],
    learningRoadmaps: [
      { label: "Cloud Engineer Roadmap", id: "cloud-engineer" },
    ],
    companiesHiring: ["Amazon", "Google", "Microsoft", "Netflix", "Uber", "Zomato"],
    skillsForMentors: ["Docker", "Kubernetes", "AWS", "DevOps"],
  },
  "data-analyst": {
    title: "Data Analyst",
    icon: "analytics",
    color: "#14B8A6",
    salary: "₹5-15 LPA",
    experience: "0-2 years",
    oversight: "Data analysts collect, process, and analyze data to help organizations make informed decisions. They transform raw data into actionable insights through reporting and visualization.",
    responsibilities: [
      "Collect and clean data from various sources",
      "Perform exploratory data analysis",
      "Create dashboards and visualizations",
      "Generate reports for stakeholders",
      "Identify trends and patterns in data",
      "Collaborate with teams on data-driven decisions",
      "Maintain data quality and documentation",
    ],
    requiredSkills: ["SQL", "Excel / Google Sheets", "Python (Pandas, NumPy)", "Data Visualization (Tableau/Power BI)", "Statistics Basics", "Critical Thinking", "Communication Skills"],
    learningRoadmaps: [
      { label: "Python Developer Roadmap", id: "python-developer" },
    ],
    companiesHiring: ["Google", "Amazon", "Flipkart", "Swiggy", "Zomato", "Razorpay"],
    skillsForMentors: ["SQL", "Python", "Data Analysis"],
  },
};

export default function CareerDetailPage() {
  const { careerId } = useParams();
  const career = CAREERS[careerId?.toLowerCase()];

  useEffect(() => {
    document.title = `${career?.title || "Career"} | SkillSwap`;
  }, [career]);

  if (!career) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 48px" }}>
        <div className="md-empty" style={{ margin: "60px auto", maxWidth: 420 }}>
          <div className="md-empty__icon"><span className="material-symbols-outlined">search_off</span></div>
          <h3 className="md-empty__title">Career not found</h3>
          <p className="md-empty__desc">This career path hasn't been added yet.</p>
          <Link to="/learner/skills" className="mp-btn mp-btn--primary" style={{ textDecoration: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Explore Skills
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="md-page" style={{ maxWidth: 1024, margin: "0 auto", padding: "24px 20px 48px" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: "0.85rem", color: "var(--mp-text-secondary)" }}>
        <Link to="/learner/skills" style={{ color: "var(--mp-primary)", textDecoration: "none" }}>Explore Skills</Link>
        <Icon name="chevron_right" style={{ fontSize: 16 }} />
        <span>{career.title}</span>
      </div>

      {/* Header */}
      <div className="mp-hero" style={{ marginBottom: 24 }}>
        <div className="mp-hero__watermark">
          <span className="material-symbols-outlined" style={{ fontSize: 78 }}>{career.icon}</span>
        </div>
        <div className="mp-hero__content">
          <div className="mp-hero__eyebrow">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>work</span>
            CAREER
          </div>
          <h1>{career.title}</h1>
          <p className="mp-hero__sub">{career.oversight}</p>
          <div className="mp-hero__actions" style={{ gap: 8 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>
              <Icon name="currency_rupee" /> {career.salary}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>
              <Icon name="timelapse" /> {career.experience}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
        {/* Main */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Responsibilities */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="list_alt" style={{ color: "var(--mp-primary)" }} /> Responsibilities
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {career.responsibilities.map((r) => (
                <div key={r} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--mp-primary-lighter)", fontSize: "0.88rem" }}>
                  <Icon name="check_circle" style={{ color: "var(--mp-success)", fontSize: 18 }} />
                  {r}
                </div>
              ))}
            </div>
          </div>

          {/* Required Skills */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="school" style={{ color: "var(--mp-purple)" }} /> Required Skills
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {career.requiredSkills.map((s) => (
                <span key={s} style={{ padding: "6px 12px", borderRadius: 999, background: "var(--mp-purple-light)", color: "var(--mp-purple)", fontSize: "0.84rem", fontWeight: 700 }}>{s}</span>
              ))}
            </div>
          </div>

          {/* Companies Hiring */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="business" style={{ color: "var(--mp-info)" }} /> Companies Hiring
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {career.companiesHiring.map((c) => (
                <span key={c} style={{ padding: "6px 14px", borderRadius: 999, border: "1px solid var(--mp-card-border)", fontSize: "0.84rem", fontWeight: 600 }}>{c}</span>
              ))}
            </div>
          </div>

          {/* Interview Preparation */}
          <div className="mp-stat" style={{ padding: 24 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="work_history" style={{ color: "var(--mp-pink)" }} /> Interview Preparation
            </h3>
            <p style={{ margin: "0 0 12px", color: "var(--mp-text-secondary)", fontSize: "0.9rem" }}>
              Prepare for interviews with these resources tailored for {career.title} roles.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="https://leetcode.com/problemset/" target="_blank" rel="noopener noreferrer" className="sk-btn sk-btn--outline sk-btn--sm" style={{ textDecoration: "none" }}>
                <Icon name="quiz" /> Practice Problems
              </a>
              <a href="https://www.geeksforgeeks.org/" target="_blank" rel="noopener noreferrer" className="sk-btn sk-btn--outline sk-btn--sm" style={{ textDecoration: "none" }}>
                <Icon name="auto_stories" /> GeeksforGeeks
              </a>
              <a href="https://www.interviewbit.com/" target="_blank" rel="noopener noreferrer" className="sk-btn sk-btn--outline sk-btn--sm" style={{ textDecoration: "none" }}>
                <Icon name="school" /> InterviewBit
              </a>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 24 }}>
          {/* Quick Info */}
          <div className="mp-stat" style={{ padding: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--mp-text-secondary)" }}>Quick Info</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--mp-text-muted)" }}>Avg. Salary</span>
                <span style={{ fontWeight: 700, color: "var(--mp-success)" }}>{career.salary}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                <span style={{ color: "var(--mp-text-muted)" }}>Experience</span>
                <span style={{ fontWeight: 700 }}>{career.experience}</span>
              </div>
            </div>
          </div>

          {/* Learning Roadmaps */}
          <div className="mp-stat" style={{ padding: 20 }}>
            <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "var(--mp-text-secondary)" }}>
              <Icon name="route" /> Learning Roadmaps
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {career.learningRoadmaps.map((rm) => (
                <Link key={rm.id} to={`/learner/roadmaps/${rm.id}`}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, background: "var(--mp-primary-lighter)", color: "var(--mp-primary)", fontSize: "0.86rem", fontWeight: 700, textDecoration: "none", transition: "all 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--mp-primary-light)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "var(--mp-primary-lighter)"; }}
                >
                  <Icon name="route" style={{ fontSize: 16 }} />
                  {rm.label}
                  <Icon name="arrow_forward" style={{ marginLeft: "auto", fontSize: 16 }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Find Mentors */}
          <Link to={`/learner/mentors?skill=${encodeURIComponent(career.skillsForMentors[0])}`}
            className="mp-btn mp-btn--primary"
            style={{ textDecoration: "none", justifyContent: "center", padding: "14px 20px" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_search</span>
            Find Mentors for This Career
          </Link>
        </div>
      </div>

      {/* Latest Job Trends Placeholder */}
      <div className="mp-stat" style={{ padding: 24, marginTop: 24 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "1.05rem", display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="trending_up" style={{ color: "var(--mp-success)" }} /> Latest Job Trends
        </h3>
        <p style={{ margin: 0, color: "var(--mp-text-secondary)", fontSize: "0.9rem" }}>
          The demand for {career.title}s continues to grow. Companies across all industries — from startups to FAANG — are actively hiring skilled professionals.
          Start your learning journey today to build the skills needed for this exciting career path.
        </p>
      </div>
    </div>
  );
}
