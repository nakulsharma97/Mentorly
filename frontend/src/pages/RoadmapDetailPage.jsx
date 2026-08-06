import { useEffect } from "react";
import { Link, useParams } from "react-router";
import Icon from "../modules/common/dashboard/Icon";
import MentorPageHero from "../modules/mentor/components/MentorPageHero";
import "./LearnerPages.css";
import "../modules/mentor/mentor-pages.css";

const ROADMAPS = {
  "java-developer": {
    title: "Java Developer",
    icon: "code",
    gradient: "linear-gradient(135deg,#ed8b00,#e8a530)",
    duration: "6-9 months",
    description: "Complete roadmap to become a professional Java developer. From fundamentals to microservices and cloud deployment.",
    milestones: [
      { title: "Java Basics", duration: "2-3 weeks", items: ["Variables & Data Types", "Control Flow (if/else, loops)", "Methods & Functions", "Arrays & Strings"], projects: ["Calculator app", "Number guessing game"] },
      { title: "Object-Oriented Programming", duration: "2-3 weeks", items: ["Classes & Objects", "Inheritance & Polymorphism", "Encapsulation & Abstraction", "Interfaces & Abstract Classes"], projects: ["Library management system", "Bank account simulator"] },
      { title: "Collections Framework", duration: "1-2 weeks", items: ["List, Set, Map", "ArrayList vs LinkedList", "HashMap & TreeMap", "Collections utilities"], projects: ["Student grade tracker", "Shopping cart"] },
      { title: "Exception Handling & I/O", duration: "1 week", items: ["Try-catch-finally", "Custom exceptions", "File I/O (Reader/Writer)", "Serialization"], projects: ["Log parser", "File backup tool"] },
      { title: "JDBC & Database", duration: "1-2 weeks", items: ["JDBC API", "CRUD operations", "Prepared Statements", "Connection pooling"], projects: ["Employee database CRUD", "Student management system"] },
      { title: "Spring Core", duration: "2 weeks", items: ["Dependency Injection", "IoC Container", "Spring Beans", "Configuration (XML & Annotations)"], projects: ["DI-based application"] },
      { title: "Spring Boot", duration: "3-4 weeks", items: ["Auto-configuration", "REST Controllers", "Spring Data JPA", "Spring Security"], projects: ["RESTful Blog API", "User authentication service"] },
      { title: "REST APIs", duration: "2 weeks", items: ["REST principles", "Request/Response handling", "HATEOAS", "API documentation (Swagger)"], projects: ["Task management API"] },
      { title: "Microservices", duration: "3-4 weeks", items: ["Service decomposition", "Inter-service communication", "API Gateway", "Service discovery"], projects: ["E-commerce microservices"] },
      { title: "Docker & Containerization", duration: "1-2 weeks", items: ["Docker basics", "Docker Compose", "Containerizing Spring Boot", "Multi-stage builds"], projects: ["Dockerized microservices"] },
      { title: "AWS Deployment", duration: "2 weeks", items: ["EC2 deployment", "RDS setup", "S3 for storage", "Elastic Beanstalk"], projects: ["Deploy to AWS"] },
    ],
    resources: [
      { label: "Official Java Docs", url: "https://docs.oracle.com/en/java/", icon: "menu_book" },
      { label: "Spring Boot Guide", url: "https://spring.io/guides", icon: "dns" },
      { label: "Java Practice", url: "https://leetcode.com/problemset/", icon: "quiz" },
      { label: "Java GitHub Topics", url: "https://github.com/topics/java", icon: "inventory_2" },
    ],
  },
  "frontend-developer": {
    title: "Frontend Developer",
    icon: "web",
    gradient: "linear-gradient(135deg,#61dafb,#3178c6)",
    duration: "4-8 months",
    description: "Complete roadmap to become a professional frontend developer. From HTML to React and modern frontend tooling.",
    milestones: [
      { title: "HTML & CSS", duration: "2-3 weeks", items: ["HTML5 Semantic Elements", "CSS Selectors & Properties", "Flexbox & Grid", "Responsive Design"], projects: ["Personal portfolio page", "Landing page clone"] },
      { title: "JavaScript Fundamentals", duration: "3-4 weeks", items: ["ES6+ Syntax", "DOM Manipulation", "Events & Listeners", "Promises & Async/Await"], projects: ["To-do app", "Weather app"] },
      { title: "React Basics", duration: "3-4 weeks", items: ["JSX & Components", "Props & State", "Hooks (useState, useEffect)", "Event Handling"], projects: ["Counter app", "Movie search"] },
      { title: "React Advanced", duration: "2-3 weeks", items: ["Context API", "Custom Hooks", "React Router", "Forms & Validation"], projects: ["Multi-page blog", "Form builder"] },
      { title: "State Management", duration: "1-2 weeks", items: ["Redux Toolkit", "Zustand (lightweight)", "State persistence", "DevTools"], projects: ["Shopping cart with Redux"] },
      { title: "Next.js", duration: "2-3 weeks", items: ["Pages & Routing", "SSR & SSG", "API Routes", "Deployment (Vercel)"], projects: ["Full-stack blog with Next.js"] },
    ],
    resources: [
      { label: "React Docs", url: "https://react.dev/", icon: "menu_book" },
      { label: "Next.js Docs", url: "https://nextjs.org/docs", icon: "web" },
      { label: "MDN Web Docs", url: "https://developer.mozilla.org/", icon: "auto_stories" },
      { label: "Frontend Practice", url: "https://frontendmentor.io/", icon: "code" },
    ],
  },
  "python-developer": {
    title: "Python Developer",
    icon: "code",
    gradient: "linear-gradient(135deg,#3776ab,#306998)",
    duration: "4-7 months",
    description: "Complete roadmap to become a professional Python developer. From basics to data science and automation.",
    milestones: [
      { title: "Python Basics", duration: "2 weeks", items: ["Variables & Types", "Lists, Tuples, Dicts", "Control Flow", "Functions & Scope"], projects: ["Calculator", "Text-based adventure"] },
      { title: "Intermediate Python", duration: "2-3 weeks", items: ["OOP in Python", "File Handling", "Modules & Packages", "Error Handling"], projects: ["File organizer", "Contact book"] },
      { title: "Libraries & Tools", duration: "2-3 weeks", items: ["NumPy", "Pandas", "Matplotlib", "Beautiful Soup"], projects: ["Data analysis dashboard", "Web scraper"] },
      { title: "APIs & Web", duration: "2 weeks", items: ["Flask/FastAPI basics", "REST endpoints", "JSON handling", "Request validation"], projects: ["REST API with Flask"] },
      { title: "Automation & Scripts", duration: "1-2 weeks", items: ["os & shutil modules", "Automating tasks", "Email sending", "Schedule tasks"], projects: ["File backup script", "Email reporter"] },
    ],
    resources: [
      { label: "Python Docs", url: "https://docs.python.org/3/", icon: "menu_book" },
      { label: "Real Python Tutorials", url: "https://realpython.com/", icon: "play_circle" },
      { label: "Python Practice", url: "https://leetcode.com/problemset/", icon: "quiz" },
      { label: "Python GitHub", url: "https://github.com/topics/python", icon: "inventory_2" },
    ],
  },
  "ai-engineer": {
    title: "AI / ML Engineer",
    icon: "psychology",
    gradient: "linear-gradient(135deg,#7c3aed,#a78bfa)",
    duration: "6-12 months",
    description: "Complete roadmap to become an AI/ML Engineer. From Python foundations to deep learning and model deployment.",
    milestones: [
      { title: "Python for AI", duration: "2-3 weeks", items: ["Python Basics Review", "NumPy & Pandas", "Matplotlib & Seaborn", "Data Manipulation"], projects: ["Exploratory data analysis", "Data cleaning pipeline"] },
      { title: "Mathematics for ML", duration: "3-4 weeks", items: ["Linear Algebra Basics", "Calculus & Optimization", "Probability & Statistics", "Hypothesis Testing"], projects: ["Statistical analysis report", "Linear regression from scratch"] },
      { title: "Machine Learning", duration: "4-6 weeks", items: ["Supervised Learning (Regression, Classification)", "Unsupervised Learning (Clustering, PCA)", "Scikit-learn Library", "Model Evaluation & Validation"], projects: ["House price prediction", "Customer segmentation"] },
      { title: "Deep Learning", duration: "4-6 weeks", items: ["Neural Networks Basics", "TensorFlow & PyTorch", "CNN for Images", "RNN/LSTM for Sequences"], projects: ["Image classifier", "Sentiment analysis model"] },
      { title: "MLOps & Deployment", duration: "2-3 weeks", items: ["Model Export & Serving", "Docker for ML", "FastAPI for ML APIs", "Model Monitoring"], projects: ["Deploy ML model as API", "ML pipeline with Docker"] },
    ],
    resources: [
      { label: "Python ML Docs", url: "https://scikit-learn.org/stable/documentation.html", icon: "menu_book" },
      { label: "TensorFlow Tutorials", url: "https://www.tensorflow.org/tutorials", icon: "play_circle" },
      { label: "Kaggle Competitions", url: "https://www.kaggle.com/competitions", icon: "quiz" },
      { label: "ML GitHub Topics", url: "https://github.com/topics/machine-learning", icon: "inventory_2" },
    ],
  },
  "cloud-engineer": {
    title: "Cloud Engineer",
    icon: "cloud",
    gradient: "linear-gradient(135deg,#FF9900,#232F3E)",
    duration: "6-10 months",
    description: "Complete roadmap to become a cloud engineer. From cloud fundamentals to AWS architecture and DevOps.",
    milestones: [
      { title: "Cloud Fundamentals", duration: "2 weeks", items: ["What is Cloud Computing", "IaaS, PaaS, SaaS", "AWS Global Infrastructure", "Free Tier Setup"], projects: ["AWS free tier exploration"] },
      { title: "Core AWS Services", duration: "3-4 weeks", items: ["EC2 (Compute)", "S3 (Storage)", "RDS (Databases)", "VPC (Networking)"], projects: ["Host a static website on S3", "WordPress on EC2"] },
      { title: "Serverless & Lambda", duration: "2 weeks", items: ["AWS Lambda", "API Gateway", "DynamoDB", "Event-driven architecture"], projects: ["Serverless REST API"] },
      { title: "DevOps & CI/CD", duration: "3-4 weeks", items: ["CodeCommit, CodeBuild", "CodePipeline", "CloudFormation", "Docker on ECS"], projects: ["CI/CD pipeline for web app"] },
      { title: "Monitoring & Security", duration: "2 weeks", items: ["CloudWatch", "IAM Policies", "AWS Shield/WAF", "Cost optimization"], projects: ["CloudWatch dashboard"] },
    ],
    resources: [
      { label: "AWS Docs", url: "https://docs.aws.amazon.com/", icon: "menu_book" },
      { label: "AWS YouTube", url: "https://www.youtube.com/@amazonwebservices", icon: "play_circle" },
      { label: "AWS Free Tier", url: "https://aws.amazon.com/free/", icon: "cloud" },
      { label: "Terraform Docs", url: "https://developer.hashicorp.com/terraform/docs", icon: "terminal" },
    ],
  },
  "fullstack-developer": {
    title: "Full Stack Developer",
    icon: "dns",
    gradient: "linear-gradient(135deg,#16a34a,#0d9488)",
    duration: "8-14 months",
    description: "Complete roadmap to become a professional full stack developer. From Node.js APIs to databases, frontend integration, and deployment.",
    milestones: [
      { title: "Node.js Fundamentals", duration: "3-4 weeks", items: ["Event Loop & Async", "Modules & NPM", "File System & Streams", "Error Handling"], projects: ["CLI to-do tool", "Markdown parser"] },
      { title: "REST APIs with Express", duration: "3-4 weeks", items: ["Routing & Middleware", "Request Validation", "Authentication (JWT)", "Error Middleware"], projects: ["Bookstore API", "Expense tracker API"] },
      { title: "Databases", duration: "3-4 weeks", items: ["SQL & PostgreSQL", "ORM (Prisma/Sequelize)", "MongoDB & Mongoose", "Indexing & Migrations"], projects: ["E-commerce schema", "Chat app with MongoDB"] },
      { title: "Frontend Integration", duration: "3-4 weeks", items: ["REST Clients", "React Query/SWR", "State Management", "Auth Flows"], projects: ["Dashboard consuming the API", "Auth-protected CRUD app"] },
      { title: "Deployment & DevOps", duration: "2-3 weeks", items: ["Docker", "CI/CD pipelines", "VPS/Cloud hosting", "Monitoring & Logging"], projects: ["Deploy full-stack app", "CI/CD pipeline setup"] },
    ],
    resources: [
      { label: "Node.js Docs", url: "https://nodejs.org/docs/latest/api/", icon: "menu_book" },
      { label: "Express Guide", url: "https://expressjs.com/", icon: "dns" },
      { label: "Prisma Docs", url: "https://www.prisma.io/docs", icon: "database" },
      { label: "Full Stack Practice", url: "https://leetcode.com/problemset/", icon: "quiz" },
    ],
  },
  "devops-engineer": {
    title: "DevOps Engineer",
    icon: "terminal",
    gradient: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    duration: "6-10 months",
    description: "Complete roadmap to become a DevOps engineer. From containerization to CI/CD, IaC, and cloud-native operations.",
    milestones: [
      { title: "Linux & Shell Scripting", duration: "2-3 weeks", items: ["Command Line Basics", "File Permissions", "Process Management", "Bash Scripting"], projects: ["Server setup script", "Log analyzer"] },
      { title: "Containerization (Docker)", duration: "3-4 weeks", items: ["Images & Containers", "Dockerfile Best Practices", "Volumes & Networks", "Docker Compose"], projects: ["Dockerize a web app", "Multi-service stack"] },
      { title: "CI/CD Pipelines", duration: "3-4 weeks", items: ["GitHub Actions", "Build & Test Stages", "Artifact Publishing", "Environment Promotion"], projects: ["Automated deploy pipeline", "Release tagging workflow"] },
      { title: "Infrastructure as Code", duration: "3-4 weeks", items: ["Terraform Basics", "Providers & State", "Ansible Config Management", "Kubernetes Fundamentals"], projects: ["Provision AWS with Terraform", "Deploy to a Kubernetes cluster"] },
      { title: "Observability & Security", duration: "2-3 weeks", items: ["Monitoring (Prometheus/Grafana)", "Logging (Loki/ELK)", "Secret Management", "Supply-chain security"], projects: ["Monitoring stack dashboard", "Secure CI/CD hardening"] },
    ],
    resources: [
      { label: "Docker Docs", url: "https://docs.docker.com/", icon: "menu_book" },
      { label: "GitHub Actions Docs", url: "https://docs.github.com/actions", icon: "rocket_launch" },
      { label: "Terraform Docs", url: "https://developer.hashicorp.com/terraform/docs", icon: "terminal" },
      { label: "Kubernetes Docs", url: "https://kubernetes.io/docs/", icon: "inventory_2" },
    ],
  },
  "data-analyst": {
    title: "Data Analyst",
    icon: "bar_chart",
    gradient: "linear-gradient(135deg,#f59e0b,#ef4444)",
    duration: "4-8 months",
    description: "Complete roadmap to become a data analyst. From SQL and spreadsheets to statistics, visualization, and business reporting.",
    milestones: [
      { title: "SQL Fundamentals", duration: "3-4 weeks", items: ["SELECT, WHERE, ORDER BY", "JOINs & Subqueries", "Aggregations & GROUP BY", "Window Functions"], projects: ["Sales database analysis", "Customer churn queries"] },
      { title: "Spreadsheets & Excel", duration: "2 weeks", items: ["Formulas & Functions", "Pivot Tables", "Data Cleaning", "Charts & Dashboards"], projects: ["Budget tracker", "KPI dashboard"] },
      { title: "Statistics & Data Analysis", duration: "3-4 weeks", items: ["Descriptive Statistics", "Probability Basics", "Hypothesis Testing", "Correlation & Regression"], projects: ["A/B test analysis", "Marketing spend analysis"] },
      { title: "Python for Analysis", duration: "3-4 weeks", items: ["Pandas & NumPy", "Data Cleaning", "Matplotlib & Seaborn", "Exploratory Analysis"], projects: ["Kaggle EDA notebook", "Automated report script"] },
      { title: "Visualization & Reporting", duration: "2-3 weeks", items: ["Dashboard Design Principles", "Tableau/Power BI Basics", "Storytelling with Data", "Stakeholder Reports"], projects: ["Interactive dashboard", "Executive summary deck"] },
    ],
    resources: [
      { label: "SQL Practice", url: "https://leetcode.com/problemset/database/", icon: "quiz" },
      { label: "Kaggle Datasets", url: "https://www.kaggle.com/datasets", icon: "database" },
      { label: "Pandas Docs", url: "https://pandas.pydata.org/docs/", icon: "menu_book" },
      { label: "Tableau Tutorials", url: "https://www.tableau.com/learn", icon: "bar_chart" },
    ],
  },
};

export default function RoadmapDetailPage() {
  const { roadmapId } = useParams();
  const roadmap = ROADMAPS[roadmapId?.toLowerCase()];

  useEffect(() => {
    document.title = `${roadmap?.title || "Roadmap"} | SkillSwap`;
  }, [roadmap]);

  if (!roadmap) {
    return (
      <div className="md-page" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div className="md-empty" style={{ margin: "60px auto", maxWidth: 420 }}>
          <div className="md-empty__icon"><span className="material-symbols-outlined">search_off</span></div>
          <h3 className="md-empty__title">Roadmap not found</h3>
          <p className="md-empty__desc">This learning roadmap doesn't exist yet.</p>
          <Link to="/learner/skills" className="mp-btn mp-btn--primary" style={{ textDecoration: "none" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Explore Skills
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="md-page" style={{ maxWidth: 1024, margin: "0 auto" }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: "0.85rem", color: "var(--mp-text-secondary)" }}>
        <Link to="/learner/skills" style={{ color: "var(--mp-primary)", textDecoration: "none" }}>Explore Skills</Link>
        <Icon name="chevron_right" style={{ fontSize: 16 }} />
        <span>Roadmap: {roadmap.title}</span>
      </div>

      {/* Header — unified hero design system */}
      <MentorPageHero
        eyebrow="LEARNING ROADMAP"
        icon={roadmap.icon}
        title={roadmap.title}
        sub={roadmap.description}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>
          <Icon name="schedule" /> {roadmap.duration}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", color: "#fff", fontSize: "0.8rem", fontWeight: 600 }}>
          <Icon name="flag" /> {roadmap.milestones.length} milestones
        </span>
      </MentorPageHero>

      {/* Milestones */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {roadmap.milestones.map((ms, idx) => (
          <div key={ms.title} className="md-animate" style={{ display: "flex", gap: 16 }}>
            {/* Timeline */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--mp-gradient)", color: "#fff", fontSize: "0.8rem", fontWeight: 800 }}>
                {idx + 1}
              </div>
              {idx < roadmap.milestones.length - 1 && (
                <div style={{ width: 2, flex: 1, background: "var(--mp-card-border)", minHeight: 20 }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, padding: 20, borderRadius: 16, border: "1px solid var(--mp-card-border)", background: "var(--mp-card)", marginBottom: idx < roadmap.milestones.length - 1 ? 0 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--mp-text)" }}>{ms.title}</h3>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, background: "var(--mp-primary-light)", color: "var(--mp-primary)", fontSize: "0.76rem", fontWeight: 700 }}>{ms.duration}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
                {ms.items.map((item) => (
                  <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "var(--mp-primary-lighter)", fontSize: "0.84rem", color: "var(--mp-text)" }}>
                    <Icon name="check_circle" style={{ fontSize: 16, color: "var(--mp-success)" }} />
                    {item}
                  </div>
                ))}
              </div>
              {ms.projects && ms.projects.length > 0 && (
                <div style={{ padding: "8px 12px", borderRadius: 10, background: "var(--mp-warning-light)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Icon name="flag" style={{ fontSize: 16, color: "var(--mp-warning)" }} />
                    <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--mp-warning)" }}>Projects:</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {ms.projects.map((p) => (
                      <span key={p} style={{ padding: "3px 8px", borderRadius: 999, background: "#fff", fontSize: "0.78rem", fontWeight: 600, color: "var(--mp-text)" }}>{p}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Resources */}
      <section style={{ marginTop: 32 }}>
        <div className="sk-section__head">
          <h2 className="sk-section__title"><Icon name="menu_book" /> Learning Resources</h2>
        </div>
        <div className="sk-resources-grid--catalog">
          {roadmap.resources.map((r) => (
            <a key={r.label} href={r.url} target="_blank" rel="noopener noreferrer" className="sk-resource-card--catalog md-animate">
              <div className="sk-resource-card--catalog__icon" style={{ background: "var(--mp-primary)" }}>
                <Icon name={r.icon} />
              </div>
              <h4 className="sk-resource-card--catalog__title">{r.label}</h4>
              <span className="sk-resource-card--catalog__btn">Open Resource <Icon name="open_in_new" /></span>
            </a>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div style={{ marginTop: 32, display: "flex", gap: 12, justifyContent: "center" }}>
        <Link to="/learner/skills" className="mp-btn mp-btn--outline" style={{ textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
          Back to Skills
        </Link>
        <Link to={`/learner/mentors?q=${encodeURIComponent(roadmap.title.split(" ")[0])}`} className="mp-btn mp-btn--primary" style={{ textDecoration: "none" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>person_search</span>
          Find Mentor
        </Link>
      </div>
    </div>
  );
}
