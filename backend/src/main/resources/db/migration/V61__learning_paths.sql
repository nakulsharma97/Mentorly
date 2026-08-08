-- ═══════════════════════════════════════════════════════════════════════════
-- V61 — Database-driven Learning Paths ("My Learning" system)
--
-- Replaces the old auto-generated / AI-assisted learning experience with a
-- fully backend-driven catalog:
--
--   career_paths        — the curated catalog of career paths a learner picks
--   learner_roadmaps    — one learner's instance of a career path
--                          (NOT_STARTED / ACTIVE / ARCHIVED, one ACTIVE max)
--   roadmap_modules     — ordered modules inside a career path
--   roadmap_lessons     — ordered lessons inside a module (+ optional assignment)
--   roadmap_projects    — portfolio projects tied to a career path
--   roadmap_resources   — external learning resources tied to a career path
--   roadmap_sessions    — recommended mentor sessions tied to a career path
--   roadmap_progress    — per-lesson completion records for a learner roadmap
--   roadmap_certificates— certificates issued when roadmap milestones complete
--
-- The platform never guesses what a learner wants: nothing is generated for a
-- new account. Learners choose a path, and progress is tracked lesson by lesson.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE career_paths (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(120) NOT NULL,
    slug            VARCHAR(120) NOT NULL UNIQUE,
    description     VARCHAR(600) NOT NULL,
    duration_weeks  INT NOT NULL,
    difficulty      VARCHAR(32) NOT NULL,
    skills          VARCHAR(1000) NOT NULL,
    icon            VARCHAR(64) NOT NULL DEFAULT 'school',
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order      INT NOT NULL DEFAULT 0,
    created_at      DATETIME(6) NOT NULL,
    updated_at      DATETIME(6) NOT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE TABLE learner_roadmaps (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    learner_id      BIGINT NOT NULL,
    career_path_id  BIGINT NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'NOT_STARTED',
    progress_percent INT NOT NULL DEFAULT 0,
    started_at      DATETIME(6) NULL,
    completed_at    DATETIME(6) NULL,
    created_at      DATETIME(6) NOT NULL,
    updated_at      DATETIME(6) NOT NULL,
    CONSTRAINT fk_lr_learner FOREIGN KEY (learner_id) REFERENCES users (id),
    CONSTRAINT fk_lr_career FOREIGN KEY (career_path_id) REFERENCES career_paths (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_lr_learner ON learner_roadmaps (learner_id);
CREATE INDEX idx_lr_career ON learner_roadmaps (career_path_id);

CREATE TABLE roadmap_modules (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    career_path_id  BIGINT NOT NULL,
    title           VARCHAR(150) NOT NULL,
    description     VARCHAR(500) NULL,
    order_index     INT NOT NULL DEFAULT 0,
    estimated_weeks INT NOT NULL DEFAULT 2,
    CONSTRAINT fk_rm_career FOREIGN KEY (career_path_id) REFERENCES career_paths (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rm_career ON roadmap_modules (career_path_id);

CREATE TABLE roadmap_lessons (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    module_id       BIGINT NOT NULL,
    title           VARCHAR(150) NOT NULL,
    description     VARCHAR(600) NULL,
    assignment      VARCHAR(600) NULL,
    duration_minutes INT NOT NULL DEFAULT 30,
    order_index     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_rl_module FOREIGN KEY (module_id) REFERENCES roadmap_modules (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rl_module ON roadmap_lessons (module_id);

CREATE TABLE roadmap_projects (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    career_path_id  BIGINT NOT NULL,
    title           VARCHAR(150) NOT NULL,
    description     VARCHAR(600) NULL,
    difficulty      VARCHAR(32) NOT NULL DEFAULT 'Intermediate',
    order_index     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_rp_career FOREIGN KEY (career_path_id) REFERENCES career_paths (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rp_career ON roadmap_projects (career_path_id);

CREATE TABLE roadmap_resources (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    career_path_id  BIGINT NOT NULL,
    title           VARCHAR(200) NOT NULL,
    url             VARCHAR(700) NOT NULL,
    resource_type   VARCHAR(32) NOT NULL DEFAULT 'DOCUMENTATION',
    order_index     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_rr_career FOREIGN KEY (career_path_id) REFERENCES career_paths (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rr_career ON roadmap_resources (career_path_id);

CREATE TABLE roadmap_sessions (
    id              BIGINT PRIMARY KEY AUTO_INCREMENT,
    career_path_id  BIGINT NOT NULL,
    title           VARCHAR(150) NOT NULL,
    description     VARCHAR(500) NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    order_index     INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_rs_career FOREIGN KEY (career_path_id) REFERENCES career_paths (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rs_career ON roadmap_sessions (career_path_id);

CREATE TABLE roadmap_progress (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    learner_roadmap_id  BIGINT NOT NULL,
    lesson_id           BIGINT NOT NULL,
    completed_at        DATETIME(6) NOT NULL,
    CONSTRAINT fk_rpr_roadmap FOREIGN KEY (learner_roadmap_id) REFERENCES learner_roadmaps (id),
    CONSTRAINT fk_rpr_lesson FOREIGN KEY (lesson_id) REFERENCES roadmap_lessons (id),
    CONSTRAINT uq_rpr UNIQUE (learner_roadmap_id, lesson_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rpr_roadmap ON roadmap_progress (learner_roadmap_id);

CREATE TABLE roadmap_certificates (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    learner_roadmap_id  BIGINT NOT NULL,
    title               VARCHAR(200) NOT NULL,
    code                VARCHAR(64) NOT NULL,
    issued_at           DATETIME(6) NOT NULL,
    CONSTRAINT fk_rc_roadmap FOREIGN KEY (learner_roadmap_id) REFERENCES learner_roadmaps (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_rc_roadmap ON roadmap_certificates (learner_roadmap_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- Career path catalog seed
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO career_paths
    (id, name, slug, description, duration_weeks, difficulty, skills, icon, active, sort_order, created_at, updated_at)
VALUES
    (1,  'Java Backend Developer', 'java-backend-developer',
     'Learn Java, OOP, Collections, JDBC, Spring Boot, REST APIs, MySQL, Security and Deployment.',
     16, 'Intermediate', 'Java,OOP,Collections,JDBC,Spring Boot,REST APIs,MySQL,Security,Deployment',
     'code', TRUE, 1, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (2,  'Spring Boot Developer', 'spring-boot-developer',
     'Master Spring Boot, Spring Data JPA, Spring Security, REST APIs, microservices and production deployment.',
     14, 'Intermediate', 'Spring Boot,Spring Data JPA,Spring Security,REST APIs,Microservices,Testing,Deployment',
     'rocket_launch', TRUE, 2, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (3,  'MERN Stack Developer', 'mern-stack-developer',
     'Build full-stack applications with MongoDB, Express, React and Node.js — from API design to deployment.',
     20, 'Intermediate', 'MongoDB,Express.js,React,Node.js,REST APIs,JWT,Deployment',
     'language', TRUE, 3, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (4,  'React Developer', 'react-developer',
     'Master modern frontend development with React, hooks, state management, routing and testing.',
     14, 'Beginner', 'HTML,CSS,JavaScript,React,Hooks,State Management,Routing,Testing',
     'view_quilt', TRUE, 4, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (5,  'Node.js Backend Developer', 'nodejs-backend-developer',
     'Build scalable backend services with Node.js, Express, MongoDB, PostgreSQL, authentication and cloud deployment.',
     14, 'Intermediate', 'Node.js,Express.js,REST APIs,MongoDB,PostgreSQL,Authentication,Deployment',
     'terminal', TRUE, 5, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (6,  'Python Developer', 'python-developer',
     'Learn Python from fundamentals to object-oriented programming, file handling, Flask APIs and testing.',
     12, 'Beginner', 'Python,OOP,Data Structures,Flask,REST APIs,Testing',
     'code_blocks', TRUE, 6, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (7,  'Data Analyst', 'data-analyst',
     'Turn raw data into decisions with SQL, Excel, Python, Pandas, statistics and powerful dashboards.',
     12, 'Beginner', 'SQL,Excel,Python,Pandas,NumPy,Data Visualization,Statistics',
     'analytics', TRUE, 7, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (8,  'DevOps Engineer', 'devops-engineer',
     'Automate everything — Linux, Git, Docker, Kubernetes, CI/CD, Terraform, AWS and monitoring.',
     16, 'Advanced', 'Linux,Git,Docker,Kubernetes,CI/CD,Terraform,AWS,Monitoring',
     'cloud', TRUE, 8, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (9,  'AI Engineer', 'ai-engineer',
     'Design and deploy intelligent systems with machine learning, deep learning, NLP, LLMs and MLOps.',
     20, 'Advanced', 'Python,Machine Learning,Deep Learning,NLP,LLMs,MLOps',
     'psychology', TRUE, 9, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (10, 'Android Developer', 'android-developer',
     'Build modern Android apps with Kotlin, Jetpack Compose, Room, Retrofit and Play Store publishing.',
     16, 'Intermediate', 'Kotlin,Android Studio,Jetpack Compose,Room,Retrofit,Deployment',
     'smartphone', TRUE, 10, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6)),
    (11, 'Machine Learning Engineer', 'machine-learning-engineer',
     'Design, train and deploy ML models at scale with scikit-learn, TensorFlow, NLP and MLOps.',
     20, 'Advanced', 'Python,Statistics,Machine Learning,Scikit-learn,TensorFlow,MLOps',
     'functions', TRUE, 11, UTC_TIMESTAMP(6), UTC_TIMESTAMP(6));

-- ═══════════════════════════════════════════════════════════════════════════
-- Modules (4 per career path; IDs 1–44)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO roadmap_modules (id, career_path_id, title, description, order_index, estimated_weeks) VALUES
    (1,  1, 'Java Fundamentals', 'Syntax, types, control flow, OOP and collections — the rock-solid foundation.', 0, 3),
    (2,  1, 'Core Backend', 'JDBC, MySQL and REST API design with pure Java.', 1, 3),
    (3,  1, 'Spring Boot', 'Dependency injection, JPA, security and JWT with the industry-standard framework.', 2, 5),
    (4,  1, 'Deployment & Production', 'Testing, containerization, CI/CD and cloud deployment.', 3, 5),
    (5,  2, 'Spring Core', 'Dependency injection, configuration, profiles and autoconfiguration.', 0, 3),
    (6,  2, 'Data Access', 'Spring Data JPA, transactions and efficient query design.', 1, 3),
    (7,  2, 'REST & Security', 'REST APIs, Spring Security and stateless JWT flows.', 2, 4),
    (8,  2, 'Advanced & Testing', 'Testing, observability, microservices and containerized delivery.', 3, 4),
    (9,  3, 'JavaScript Essentials', 'Modern ES6+ syntax, async patterns and tooling.', 0, 3),
    (10, 3, 'Frontend with React', 'Components, hooks, routing and forms for rich UIs.', 1, 5),
    (11, 3, 'Backend with Node & Express', 'Express servers, REST APIs and JWT authentication.', 2, 5),
    (12, 3, 'Database & Deployment', 'MongoDB, Mongoose data modeling and full-stack deployment.', 3, 4),
    (13, 4, 'Web Foundations', 'HTML, CSS, Flexbox, Grid and JavaScript fundamentals.', 0, 3),
    (14, 4, 'React Core', 'Components, JSX, props, state and hooks.', 1, 5),
    (15, 4, 'Advanced React', 'Context, reducers, routing and component testing.', 2, 4),
    (16, 4, 'Build & Ship', 'Performance, accessibility and production deployment.', 3, 2),
    (17, 5, 'Node Fundamentals', 'The runtime, module system, npm and the event loop.', 0, 3),
    (18, 5, 'Building APIs', 'Express, middleware, error handling and REST API design.', 1, 4),
    (19, 5, 'Databases', 'MongoDB, Mongoose, PostgreSQL and ORM migrations.', 2, 4),
    (20, 5, 'Auth & Production', 'JWT auth, testing and deploying Node services.', 3, 3),
    (21, 6, 'Python Basics', 'Syntax, data types, control flow, functions and file I/O.', 0, 3),
    (22, 6, 'OOP & Advanced', 'Classes, modules, exceptions and best practices.', 1, 3),
    (23, 6, 'Web with Flask', 'Flask servers, templates, forms and REST APIs.', 2, 3),
    (24, 6, 'Tooling & Packaging', 'Virtual environments, pytest and publishing packages.', 3, 3),
    (25, 7, 'Data Foundations', 'Spreadsheets, data cleaning and understanding data sources.', 0, 3),
    (26, 7, 'SQL', 'Queries, joins, aggregations and advanced analytics SQL.', 1, 3),
    (27, 7, 'Python for Data', 'Pandas, NumPy and exploratory data analysis.', 2, 3),
    (28, 7, 'Visualization & Reporting', 'Matplotlib, Tableau, dashboards and storytelling.', 3, 3),
    (29, 8, 'Linux & Git', 'The Linux CLI, shell scripting and version control.', 0, 3),
    (30, 8, 'Containers', 'Docker, Docker Compose and container best practices.', 1, 4),
    (31, 8, 'CI/CD & IaC', 'GitHub Actions, Terraform and Ansible automation.', 2, 5),
    (32, 8, 'Cloud & Monitoring', 'AWS, Kubernetes and observability with Prometheus.', 3, 4),
    (33, 9, 'Python & Math Foundations', 'Python for AI, linear algebra and statistics.', 0, 4),
    (34, 9, 'Machine Learning', 'Supervised and unsupervised learning with scikit-learn.', 1, 5),
    (35, 9, 'Deep Learning', 'Neural networks, TensorFlow, PyTorch, CNNs and RNNs.', 2, 5),
    (36, 9, 'LLMs & MLOps', 'NLP, transformers, RAG pipelines and model deployment.', 3, 4),
    (37, 10, 'Kotlin & Android Basics', 'Kotlin, Android Studio and the activity lifecycle.', 0, 4),
    (38, 10, 'UI with Jetpack Compose', 'Declarative UI, layouts, Material Design and navigation.', 1, 4),
    (39, 10, 'Data & Networking', 'Room, Retrofit, coroutines and flows.', 2, 4),
    (40, 10, 'Build & Publish', 'Testing, performance and Play Store publishing.', 3, 4),
    (41, 11, 'Python & Statistics', 'Python for data science, statistics and data wrangling.', 0, 4),
    (42, 11, 'Core ML Algorithms', 'Supervised learning, ensembles and model evaluation.', 1, 5),
    (43, 11, 'Deep Learning & NLP', 'Neural networks, transformers, NLP and vision.', 2, 5),
    (44, 11, 'MLOps & Deployment', 'Experiment tracking, model serving and ML pipelines.', 3, 4);

-- ═══════════════════════════════════════════════════════════════════════════
-- Lessons (3 per module; IDs 1–132)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO roadmap_lessons (id, module_id, title, description, assignment, duration_minutes, order_index) VALUES
    -- Path 1: Java Backend (modules 1-4)
    (1, 1, 'Java Syntax & Tooling', 'Install the JDK, set up IntelliJ and write your first Java program. Cover variables, data types, operators and control flow.', 'Write a console program that takes user input and prints a formatted receipt.', 45, 0),
    (2, 1, 'Object-Oriented Programming', 'Classes, objects, inheritance, polymorphism, encapsulation and interfaces — the foundation of every Java codebase.', 'Model a bank account system using classes and inheritance.', 60, 1),
    (3, 1, 'Collections & Streams', 'Lists, Sets, Maps, Queues and the Stream API. Know which collection to use and why.', 'Build an in-memory expense tracker using Map and List with stream operations.', 60, 2),
    (4, 2, 'JDBC & MySQL', 'Connect Java to MySQL, write queries with JDBC, manage transactions and avoid SQL injection.', 'Create a CRUD layer for a task table using JDBC prepared statements.', 60, 0),
    (5, 2, 'REST API Design', 'HTTP semantics, resource modeling, status codes, validation and documentation with OpenAPI.', 'Design the API contract for a task tracker.', 60, 1),
    (6, 2, 'Building a REST API', 'Build a complete REST API in Java using JDBC, then test every endpoint.', 'Expose CRUD endpoints for tasks and test them with Postman.', 90, 2),
    (7, 3, 'Spring Boot Basics', 'Dependency injection, autoconfiguration, starters, profiles and the actuator.', 'Scaffold a Spring Boot project with Spring Initializr and expose a /hello endpoint.', 90, 0),
    (8, 3, 'Spring Data JPA', 'Entities, repositories, relationships, JPQL and transaction management.', 'Map a one-to-many relationship and add pagination to a repository.', 90, 1),
    (9, 3, 'Spring Security & JWT', 'Authentication, authorization and stateless JWT flows.', 'Secure your API with JWT authentication and role-based access.', 90, 2),
    (10, 4, 'Testing', 'Unit tests with JUnit and Mockito, integration tests and test-driven development.', 'Write unit tests covering the core service layer.', 60, 0),
    (11, 4, 'Docker & CI/CD', 'Containerize the app, write a multi-stage Dockerfile and automate builds with GitHub Actions.', 'Containerize the app and add a CI pipeline that runs tests.', 90, 1),
    (12, 4, 'Cloud Deployment', 'Deploy to the cloud: EC2, RDS, environment configuration and monitoring.', 'Deploy the app to the cloud with a managed database.', 90, 2),
    -- Path 2: Spring Boot (modules 5-8)
    (13, 5, 'Spring IoC & Dependency Injection', 'Understand the IoC container, bean wiring and constructor injection.', 'Refactor a service to use constructor injection and interfaces.', 60, 0),
    (14, 5, 'Spring Configuration & Profiles', 'Java config, properties, YAML and environment profiles.', 'Add dev and prod profiles with separate configuration.', 60, 1),
    (15, 5, 'Spring Boot Autoconfiguration', 'How starters and autoconfiguration work under the hood.', 'Debug the auto-configuration report and override a bean.', 60, 2),
    (16, 6, 'Spring Data JPA', 'Entities, repositories, derived queries and entity relationships.', 'Model an order and item relationship with JPA.', 90, 0),
    (17, 6, 'Transactions & Concurrency', 'ACID, isolation levels, @Transactional and optimistic locking.', 'Add transaction boundaries to a money-transfer service.', 60, 1),
    (18, 6, 'Query Methods & Pagination', 'Derived queries, JPQL, native queries and Pageable.', 'Implement search with pagination and sorting.', 60, 2),
    (19, 7, 'Building REST APIs', 'RESTful resource design, DTOs and validation with Spring.', 'Build a complete REST API for an order system.', 90, 0),
    (20, 7, 'Spring Security', 'Security filter chains, authentication providers and method security.', 'Lock down your API and add role-based access.', 90, 1),
    (21, 7, 'JWT & Refresh Tokens', 'Issuing JWTs, refresh token rotation and stateless sessions.', 'Implement login and refresh token flows.', 90, 2),
    (22, 8, 'Testing with JUnit & Mockito', 'Unit and integration testing for Spring Boot services and controllers.', 'Cover the service layer with unit tests.', 60, 0),
    (23, 8, 'Actuator & Monitoring', 'Health checks, metrics and production observability.', 'Expose health and metrics endpoints via Actuator.', 60, 1),
    (24, 8, 'Microservices & Docker', 'Service boundaries, containerization and compose-based local stacks.', 'Split a monolith into two services and run them with Docker Compose.', 90, 2),
    -- Path 3: MERN (modules 9-12)
    (25, 9, 'ES6+ Syntax', 'Arrow functions, destructuring, template literals, classes and modules.', 'Rewrite a legacy script using modern ES6+ features.', 45, 0),
    (26, 9, 'Async JavaScript', 'Promises, async/await and the event loop.', 'Refactor callback-based code to async/await.', 60, 1),
    (27, 9, 'Modules & Tooling', 'ES modules, npm, Vite and bundlers.', 'Set up a Vite project with npm scripts.', 45, 2),
    (28, 10, 'React Components & Props', 'Components, JSX, props and composition.', 'Build a card component library.', 60, 0),
    (29, 10, 'Hooks & State', 'useState, useEffect and custom hooks.', 'Build a counter with local persistence.', 60, 1),
    (30, 10, 'Routing & Forms', 'React Router, controlled forms and validation.', 'Add multi-page routing to an app.', 90, 2),
    (31, 11, 'Express Fundamentals', 'Servers, routes, middleware and static files.', 'Build a basic Express server with two routes.', 60, 0),
    (32, 11, 'REST APIs with Express', 'REST design, validation and error handling.', 'Build a CRUD REST API for notes.', 90, 1),
    (33, 11, 'Authentication & JWT', 'Password hashing, JWT issuance and protected routes.', 'Add signup, login and protected routes.', 90, 2),
    (34, 12, 'MongoDB & Mongoose', 'Documents, schemas and Mongoose models.', 'Design schemas for a task manager.', 60, 0),
    (35, 12, 'Data Modeling', 'Relationships, indexing and aggregation pipelines.', 'Implement an aggregation pipeline for a dashboard.', 90, 1),
    (36, 12, 'Deployment', 'Environment variables, build steps and deploying to Render/Vercel.', 'Deploy the full-stack app to the cloud.', 90, 2),
    -- Path 4: React (modules 13-16)
    (37, 13, 'HTML & CSS', 'Semantic markup, selectors, box model and typography.', 'Build a landing page hero with semantic HTML.', 60, 0),
    (38, 13, 'Flexbox & Grid', 'Modern layout with Flexbox and CSS Grid.', 'Rebuild a dashboard layout using Grid.', 60, 1),
    (39, 13, 'JavaScript Fundamentals', 'Variables, functions, arrays, objects and the DOM.', 'Build an interactive FAQ accordion.', 60, 2),
    (40, 14, 'Components & JSX', 'JSX, components and rendering lists.', 'Refactor a static page into components.', 60, 0),
    (41, 14, 'Props & State', 'One-way data flow, lifting state and event handling.', 'Build a controlled form component.', 60, 1),
    (42, 14, 'Hooks Deep Dive', 'Custom hooks, useMemo, useCallback and effects.', 'Extract a useDebounce custom hook.', 90, 2),
    (43, 15, 'Context & Reducers', 'Global state with Context and useReducer.', 'Migrate prop drilling to Context.', 60, 0),
    (44, 15, 'React Router', 'Routes, layouts, navigation and protected routes.', 'Add routing with protected pages.', 90, 1),
    (45, 15, 'Testing Components', 'Testing Library, user events and mocking.', 'Write tests for a component and a hook.', 60, 2),
    (46, 16, 'Performance Optimization', 'Memoization, code splitting and the React DevTools profiler.', 'Reduce re-renders in a list-heavy component.', 60, 0),
    (47, 16, 'Accessibility', 'Semantic roles, focus management and ARIA.', 'Run an axe audit and fix violations.', 45, 1),
    (48, 16, 'Deployment', 'Build optimization and deploying to Netlify/Vercel.', 'Deploy the app and set up previews.', 60, 2),
    -- Path 5: Node.js (modules 17-20)
    (49, 17, 'Node Runtime & Modules', 'The Node runtime, CommonJS/ES modules and globals.', 'Write a small CLI using Node core modules.', 45, 0),
    (50, 17, 'npm & Tooling', 'Package management, scripts and ecosystem tooling.', 'Set up a project with scripts and ESLint.', 45, 1),
    (51, 17, 'Event Loop & Streams', 'The event loop, buffers and streaming data.', 'Build a file-streaming utility.', 60, 2),
    (52, 18, 'Express Fundamentals', 'Routing, middleware and request lifecycle.', 'Build an Express server with middleware.', 60, 0),
    (53, 18, 'Middleware & Error Handling', 'Custom middleware, error handlers and validation.', 'Add centralized error handling to an API.', 60, 1),
    (54, 18, 'REST API Design', 'Resource modeling, status codes and versioning.', 'Design and build a RESTful task API.', 90, 2),
    (55, 19, 'MongoDB & Mongoose', 'Schemas, models and CRUD with Mongoose.', 'Create Mongoose models for a blog.', 60, 0),
    (56, 19, 'PostgreSQL & SQL', 'SQL, relations and connecting Node to Postgres.', 'Design a normalized Postgres schema.', 90, 1),
    (57, 19, 'ORMs & Migrations', 'Prisma migrations and type-safe queries.', 'Add a Prisma schema and run a migration.', 90, 2),
    (58, 20, 'JWT Authentication', 'Hashing, tokens and protected routes.', 'Add full auth flow to an API.', 90, 0),
    (59, 20, 'Testing & Debugging', 'Unit tests, supertest and debugging techniques.', 'Write API integration tests.', 60, 1),
    (60, 20, 'Deployment', 'Process managers, env config and cloud deployment.', 'Deploy the API with a managed database.', 90, 2),
    -- Path 6: Python (modules 21-24)
    (61, 21, 'Syntax & Data Types', 'Variables, numbers, strings, lists, tuples and dictionaries.', 'Build a simple contact book.', 45, 0),
    (62, 21, 'Control Flow & Functions', 'Conditionals, loops, functions and scope.', 'Write a program that validates passwords.', 60, 1),
    (63, 21, 'Strings & File I/O', 'String methods, reading and writing files.', 'Build a log-file analyzer.', 60, 2),
    (64, 22, 'Classes & Objects', 'Classes, attributes, methods and dunder methods.', 'Model a banking system with classes.', 60, 0),
    (65, 22, 'Modules & Packages', 'Imports, standard library and creating packages.', 'Split a script into importable modules.', 45, 1),
    (66, 22, 'Exceptions & Testing', 'Handling exceptions and writing unit tests.', 'Add error handling and tests to a project.', 60, 2),
    (67, 23, 'Flask Fundamentals', 'Routes, templates and static files.', 'Build a Flask site with three pages.', 60, 0),
    (68, 23, 'Templates & Forms', 'Jinja2 templates, forms and validation.', 'Add a contact form with validation.', 60, 1),
    (69, 23, 'REST APIs with Flask', 'JSON APIs and request handling.', 'Build a REST API for notes.', 90, 2),
    (70, 24, 'Virtual Environments', 'venv, pip and dependency management.', 'Set up a reproducible project environment.', 45, 0),
    (71, 24, 'Testing with Pytest', 'Fixtures, parametrize and test structure.', 'Write a pytest suite for a module.', 60, 1),
    (72, 24, 'Packaging & Deployment', 'pyproject.toml and deploying a Flask app.', 'Package the app and deploy it.', 90, 2),
    -- Path 7: Data Analyst (modules 25-28)
    (73, 25, 'Excel & Spreadsheets', 'Formulas, pivot tables and data cleaning in Excel.', 'Clean a messy sales spreadsheet.', 60, 0),
    (74, 25, 'Data Cleaning', 'Missing values, duplicates and consistent formats.', 'Document a data-cleaning pipeline.', 60, 1),
    (75, 25, 'Data Types & Sources', 'Structured vs unstructured data and sourcing data.', 'Inventory the data sources for a business question.', 45, 2),
    (76, 26, 'SQL Basics', 'SELECT, WHERE, ORDER BY and LIMIT.', 'Answer ten questions from a sample database.', 60, 0),
    (77, 26, 'Joins & Aggregations', 'JOINs, GROUP BY, HAVING and window functions.', 'Write a monthly revenue report query.', 90, 1),
    (78, 26, 'Advanced Queries', 'Subqueries, CTEs and query optimization.', 'Rewrite slow queries using CTEs.', 60, 2),
    (79, 27, 'Pandas Basics', 'DataFrames, filtering and cleaning with Pandas.', 'Load and clean a CSV with Pandas.', 60, 0),
    (80, 27, 'NumPy & Arrays', 'Arrays, vectorized operations and broadcasting.', 'Vectorize a numeric analysis.', 60, 1),
    (81, 27, 'Exploratory Data Analysis', 'Summary stats, distributions and correlations.', 'Produce an EDA notebook for a dataset.', 90, 2),
    (82, 28, 'Matplotlib & Seaborn', 'Charts, subplots and visual best practices.', 'Build a multi-chart report.', 60, 0),
    (83, 28, 'Tableau & Power BI', 'Dashboards, filters and interactive reports.', 'Create a dashboard from the sales data.', 90, 1),
    (84, 28, 'Dashboards & Storytelling', 'Framing insights for stakeholders.', 'Present a 5-slide findings deck.', 60, 2),
    -- Path 8: DevOps (modules 29-32)
    (85, 29, 'Linux CLI', 'Files, processes, permissions and pipes.', 'Complete a CLI scavenger hunt.', 60, 0),
    (86, 29, 'Shell Scripting', 'Bash variables, loops and cron jobs.', 'Write a backup script.', 60, 1),
    (87, 29, 'Git & Version Control', 'Branches, rebase, remotes and workflows.', 'Contribute to a team repository using a PR workflow.', 60, 2),
    (88, 30, 'Docker Basics', 'Images, containers, Dockerfiles and registries.', 'Containerize a simple app.', 90, 0),
    (89, 30, 'Docker Compose', 'Multi-service stacks and volumes.', 'Compose a web app with a database.', 90, 1),
    (90, 30, 'Container Best Practices', 'Layers, security and resource limits.', 'Harden and slim an existing image.', 60, 2),
    (91, 31, 'GitHub Actions', 'Workflows, jobs, matrices and caches.', 'Build a CI pipeline that lints, tests and builds.', 90, 0),
    (92, 31, 'Terraform', 'Providers, resources, state and modules.', 'Provision infrastructure as code.', 90, 1),
    (93, 31, 'Ansible', 'Playbooks, inventory and configuration management.', 'Automate server configuration with Ansible.', 90, 2),
    (94, 32, 'AWS Fundamentals', 'EC2, VPC, IAM, S3 and RDS.', 'Launch a secured EC2 instance with S3 storage.', 90, 0),
    (95, 32, 'Kubernetes', 'Pods, deployments, services and ingress.', 'Deploy an app to a cluster.', 90, 1),
    (96, 32, 'Monitoring & Observability', 'Prometheus, Grafana and log aggregation.', 'Set up dashboards and alerts.', 90, 2),
    -- Path 9: AI Engineer (modules 33-36)
    (97, 33, 'Python for AI', 'NumPy, Pandas and data manipulation for ML.', 'Build a data pipeline in Python.', 60, 0),
    (98, 33, 'Linear Algebra', 'Vectors, matrices and eigenvalues for ML.', 'Implement matrix operations with NumPy.', 60, 1),
    (99, 33, 'Statistics & Probability', 'Distributions, hypothesis testing and Bayes.', 'Run statistical tests on a sample dataset.', 60, 2),
    (100, 34, 'ML Fundamentals', 'Bias-variance, train/test splits and pipelines.', 'Build a simple model pipeline.', 60, 0),
    (101, 34, 'Supervised Learning', 'Regression and classification with scikit-learn.', 'Train and compare three classifiers.', 90, 1),
    (102, 34, 'Unsupervised Learning', 'Clustering and dimensionality reduction.', 'Cluster a customer dataset.', 90, 2),
    (103, 35, 'Neural Networks', 'Perceptrons, backpropagation and training loops.', 'Train a neural net on MNIST.', 90, 0),
    (104, 35, 'TensorFlow & PyTorch', 'Frameworks, models and training APIs.', 'Reproduce a model in both frameworks.', 90, 1),
    (105, 35, 'CNNs & RNNs', 'Convolutional and recurrent architectures.', 'Build an image classifier with a CNN.', 90, 2),
    (106, 36, 'NLP & Transformers', 'Tokenization, embeddings and transformer models.', 'Fine-tune a small transformer.', 90, 0),
    (107, 36, 'LLMs & RAG', 'Prompting, retrieval-augmented generation and agents.', 'Build a RAG chatbot over your documents.', 90, 1),
    (108, 36, 'MLOps & Deployment', 'Model registries, serving and monitoring.', 'Deploy a model behind an API.', 90, 2),
    -- Path 10: Android (modules 37-40)
    (109, 37, 'Kotlin Basics', 'Variables, null safety, functions and classes.', 'Write a Kotlin console app.', 60, 0),
    (110, 37, 'Android Studio & Project Structure', 'Gradle, manifests, resources and emulators.', 'Create a project and run it on an emulator.', 60, 1),
    (111, 37, 'Activities & Intents', 'The activity lifecycle and intents.', 'Build a two-screen flow.', 60, 2),
    (112, 38, 'Jetpack Compose', 'Composable functions, state and recomposition.', 'Rebuild a screen in Compose.', 90, 0),
    (113, 38, 'Layouts & Material Design', 'Row, Column, LazyColumn and Material 3.', 'Build a list-detail interface.', 90, 1),
    (114, 38, 'State & Navigation', 'ViewModel, state hoisting and Navigation Compose.', 'Add navigation with a shared ViewModel.', 90, 2),
    (115, 39, 'Room Database', 'Entities, DAOs and database migrations.', 'Persist a todo list with Room.', 90, 0),
    (116, 39, 'Retrofit & APIs', 'Networking, JSON parsing and error handling.', 'Fetch data from a REST API.', 90, 1),
    (117, 39, 'Coroutines & Flows', 'Suspending functions and reactive flows.', 'Make a network call with coroutines.', 60, 2),
    (118, 40, 'Testing', 'Unit tests and UI tests with Compose.', 'Write tests for the ViewModel and UI.', 60, 0),
    (119, 40, 'Performance & App Size', 'Profiling, app size and resource optimization.', 'Optimize the app and reduce APK size.', 60, 1),
    (120, 40, 'Publishing to Play Store', 'Signing, internal testing and release tracks.', 'Upload an internal test release.', 90, 2),
    -- Path 11: ML Engineer (modules 41-44)
    (121, 41, 'Python for Data Science', 'Pandas, NumPy and data pipelines.', 'Prepare a dataset for modeling.', 60, 0),
    (122, 41, 'Statistics for ML', 'Distributions, hypothesis tests and metrics.', 'Run an A/B test analysis.', 60, 1),
    (123, 41, 'Data Wrangling', 'Cleaning, imputation and feature engineering.', 'Engineer features for a tabular dataset.', 90, 2),
    (124, 42, 'Supervised Learning', 'Regression and classification algorithms.', 'Train and tune a baseline model.', 90, 0),
    (125, 42, 'Ensemble Methods', 'Random forests, gradient boosting and stacking.', 'Boost model performance with ensembles.', 90, 1),
    (126, 42, 'Model Evaluation', 'Cross-validation, metrics and hyperparameter tuning.', 'Set up a rigorous evaluation harness.', 60, 2),
    (127, 43, 'Neural Networks', 'Dense networks, activations and training.', 'Train a neural network from scratch.', 90, 0),
    (128, 43, 'NLP & Transformers', 'Tokenization, embeddings and fine-tuning.', 'Fine-tune a sentiment model.', 90, 1),
    (129, 43, 'Computer Vision', 'CNNs, data augmentation and transfer learning.', 'Build an image classifier.', 90, 2),
    (130, 44, 'Experiment Tracking', 'MLflow, runs and metrics logging.', 'Track an experiment with MLflow.', 60, 0),
    (131, 44, 'Model Serving', 'APIs, batching and serving frameworks.', 'Serve a model with an API endpoint.', 90, 1),
    (132, 44, 'CI/CD for ML', 'Pipeline automation and model validation gates.', 'Add automated retraining to a pipeline.', 90, 2);

-- ═══════════════════════════════════════════════════════════════════════════
-- Projects (3 per career path; IDs 1–33)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO roadmap_projects (id, career_path_id, title, description, difficulty, order_index) VALUES
    (1,  1, 'Todo API', 'Build a RESTful Todo API with CRUD operations, validation and persistent storage.', 'Intermediate', 0),
    (2,  1, 'Library Management System', 'Manage books, members and loans with Spring Boot, JPA and role-based access.', 'Intermediate', 1),
    (3,  1, 'Blog REST API', 'Create a full blog platform with posts, comments, authentication and pagination.', 'Advanced', 2),
    (4,  2, 'Order Management API', 'An order lifecycle API with inventory, transactions and event logging.', 'Intermediate', 0),
    (5,  2, 'Library Management System', 'A Spring Data JPA library system with search, pagination and role-based access.', 'Intermediate', 1),
    (6,  2, 'Expense Tracker API', 'Track expenses with categories, reports and JWT-protected endpoints.', 'Advanced', 2),
    (7,  3, 'Task Manager App', 'A full-stack MERN task manager with auth, boards and real-time updates.', 'Intermediate', 0),
    (8,  3, 'E-Commerce Store', 'Products, carts, checkout and admin dashboards built with the MERN stack.', 'Advanced', 1),
    (9,  3, 'Chat Application', 'A real-time chat app with rooms, typing indicators and read receipts.', 'Advanced', 2),
    (10, 4, 'Weather App', 'A React weather app with live API data, search and unit toggling.', 'Beginner', 0),
    (11, 4, 'E-Commerce UI', 'A product catalog, cart and checkout flow with state management.', 'Intermediate', 1),
    (12, 4, 'Chat Application', 'A polished chat UI with routing, optimistic updates and accessibility.', 'Advanced', 2),
    (13, 5, 'RESTful Task API', 'A Node.js task API with Express, validation and JWT auth.', 'Intermediate', 0),
    (14, 5, 'Blog Platform API', 'A blog API with Postgres, Prisma and role-based publishing.', 'Advanced', 1),
    (15, 5, 'URL Shortener', 'A scalable URL shortener with analytics and caching.', 'Advanced', 2),
    (16, 6, 'To-Do CLI App', 'A command-line to-do manager with file persistence.', 'Beginner', 0),
    (17, 6, 'Expense Tracker', 'A Python expense tracker with categories and monthly reports.', 'Intermediate', 1),
    (18, 6, 'Flask REST API', 'A Flask notes API with SQLite and token auth.', 'Intermediate', 2),
    (19, 7, 'Sales Dashboard', 'An interactive dashboard analyzing regional sales trends.', 'Beginner', 0),
    (20, 7, 'Customer Churn Analysis', 'Analyze churn drivers and present findings with charts.', 'Intermediate', 1),
    (21, 7, 'COVID Data Analysis', 'Explore and visualize a public health dataset end-to-end.', 'Intermediate', 2),
    (22, 8, 'CI/CD Pipeline Setup', 'Automate build, test and deploy for a sample app.', 'Intermediate', 0),
    (23, 8, 'Dockerized Microservices', 'Run a multi-service stack with Docker Compose and health checks.', 'Advanced', 1),
    (24, 8, 'Infrastructure as Code', 'Provision a full environment with Terraform and Ansible.', 'Advanced', 2),
    (25, 9, 'Image Classifier', 'Train and deploy a CNN image classifier.', 'Advanced', 0),
    (26, 9, 'Chatbot with LLM', 'A RAG-powered chatbot grounded in your own documents.', 'Advanced', 1),
    (27, 9, 'Recommendation System', 'Build a content-based recommendation engine.', 'Intermediate', 2),
    (28, 10, 'Weather App', 'An Android weather app with location and Retrofit.', 'Beginner', 0),
    (29, 10, 'Note-Taking App', 'A Compose note app with Room persistence and search.', 'Intermediate', 1),
    (30, 10, 'Expense Tracker App', 'An Android expense tracker with charts and reports.', 'Advanced', 2),
    (31, 11, 'Housing Price Predictor', 'Train a regression model on housing data with evaluation.', 'Intermediate', 0),
    (32, 11, 'Sentiment Analysis Model', 'Fine-tune a model to classify review sentiment.', 'Advanced', 1),
    (33, 11, 'Image Classifier', 'Deploy a production-ready image classification API.', 'Advanced', 2);

-- ═══════════════════════════════════════════════════════════════════════════
-- Resources (5 per career path; IDs 1–55)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO roadmap_resources (id, career_path_id, title, url, resource_type, order_index) VALUES
    (1,  1, 'Oracle Java Documentation', 'https://docs.oracle.com/en/java/', 'DOCUMENTATION', 0),
    (2,  1, 'Spring Documentation', 'https://spring.io/projects/spring-boot', 'DOCUMENTATION', 1),
    (3,  1, 'Baeldung — Java & Spring Tutorials', 'https://www.baeldung.com/', 'ARTICLE', 2),
    (4,  1, 'Java Programming — Full Course (YouTube)', 'https://www.youtube.com/results?search_query=java+programming+full+course', 'VIDEO', 3),
    (5,  1, 'Java Tutorials — GeeksforGeeks', 'https://www.geeksforgeeks.org/java/', 'ARTICLE', 4),
    (6,  2, 'Spring Initializr', 'https://start.spring.io/', 'TOOL', 0),
    (7,  2, 'Spring Boot Reference Documentation', 'https://docs.spring.io/spring-boot/', 'DOCUMENTATION', 1),
    (8,  2, 'Spring Security Documentation', 'https://docs.spring.io/spring-security/', 'DOCUMENTATION', 2),
    (9,  2, 'Baeldung — Spring Tutorials', 'https://www.baeldung.com/spring-boot', 'ARTICLE', 3),
    (10, 2, 'Spring Data JPA Reference', 'https://docs.spring.io/spring-data/jpa/', 'DOCUMENTATION', 4),
    (11, 3, 'MDN JavaScript Guide', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide', 'DOCUMENTATION', 0),
    (12, 3, 'React Documentation', 'https://react.dev/', 'DOCUMENTATION', 1),
    (13, 3, 'Node.js Documentation', 'https://nodejs.org/en/docs', 'DOCUMENTATION', 2),
    (14, 3, 'MongoDB University', 'https://learn.mongodb.com/', 'COURSE', 3),
    (15, 3, 'Express Guide', 'https://expressjs.com/en/guide/routing.html', 'DOCUMENTATION', 4),
    (16, 4, 'React Documentation', 'https://react.dev/', 'DOCUMENTATION', 0),
    (17, 4, 'Redux Documentation', 'https://redux.js.org/', 'DOCUMENTATION', 1),
    (18, 4, 'React Router Documentation', 'https://reactrouter.com/', 'DOCUMENTATION', 2),
    (19, 4, 'MDN CSS Guide', 'https://developer.mozilla.org/en-US/docs/Web/CSS', 'DOCUMENTATION', 3),
    (20, 4, 'The Modern JavaScript Tutorial', 'https://javascript.info/', 'ARTICLE', 4),
    (21, 5, 'Node.js Documentation', 'https://nodejs.org/en/docs', 'DOCUMENTATION', 0),
    (22, 5, 'Express Documentation', 'https://expressjs.com/', 'DOCUMENTATION', 1),
    (23, 5, 'MDN — HTTP', 'https://developer.mozilla.org/en-US/docs/Web/HTTP', 'DOCUMENTATION', 2),
    (24, 5, 'MongoDB University', 'https://learn.mongodb.com/', 'COURSE', 3),
    (25, 5, 'Prisma Documentation', 'https://www.prisma.io/docs', 'DOCUMENTATION', 4),
    (26, 6, 'Python Official Documentation', 'https://docs.python.org/3/', 'DOCUMENTATION', 0),
    (27, 6, 'Real Python Tutorials', 'https://realpython.com/', 'ARTICLE', 1),
    (28, 6, 'W3Schools Python', 'https://www.w3schools.com/python/', 'ARTICLE', 2),
    (29, 6, 'Python for Beginners — Full Course (YouTube)', 'https://www.youtube.com/results?search_query=python+programming+full+course', 'VIDEO', 3),
    (30, 6, 'Flask Documentation', 'https://flask.palletsprojects.com/', 'DOCUMENTATION', 4),
    (31, 7, 'SQL Tutorial — W3Schools', 'https://www.w3schools.com/sql/', 'COURSE', 0),
    (32, 7, 'Pandas Documentation', 'https://pandas.pydata.org/docs/', 'DOCUMENTATION', 1),
    (33, 7, 'Kaggle Learn', 'https://www.kaggle.com/learn', 'COURSE', 2),
    (34, 7, 'Google Data Analytics (YouTube)', 'https://www.youtube.com/results?search_query=google+data+analytics+course', 'VIDEO', 3),
    (35, 7, 'Tableau Tutorials', 'https://www.tableau.com/learn/tutorials', 'COURSE', 4),
    (36, 8, 'Docker Documentation', 'https://docs.docker.com/', 'DOCUMENTATION', 0),
    (37, 8, 'GitHub Actions Documentation', 'https://docs.github.com/actions', 'DOCUMENTATION', 1),
    (38, 8, 'Terraform Documentation', 'https://developer.hashicorp.com/terraform/docs', 'DOCUMENTATION', 2),
    (39, 8, 'Kubernetes Documentation', 'https://kubernetes.io/docs/', 'DOCUMENTATION', 3),
    (40, 8, 'AWS Getting Started', 'https://aws.amazon.com/getting-started/', 'COURSE', 4),
    (41, 9, 'TensorFlow Documentation', 'https://www.tensorflow.org/docs', 'DOCUMENTATION', 0),
    (42, 9, 'PyTorch Documentation', 'https://pytorch.org/docs/', 'DOCUMENTATION', 1),
    (43, 9, 'Hugging Face Docs', 'https://huggingface.co/docs', 'DOCUMENTATION', 2),
    (44, 9, 'Deep Learning Specialization (YouTube)', 'https://www.youtube.com/results?search_query=deep+learning+specialization+course', 'VIDEO', 3),
    (45, 9, 'scikit-learn Documentation', 'https://scikit-learn.org/stable/', 'DOCUMENTATION', 4),
    (46, 10, 'Android Developers Documentation', 'https://developer.android.com/docs', 'DOCUMENTATION', 0),
    (47, 10, 'Kotlin Documentation', 'https://kotlinlang.org/docs/home.html', 'DOCUMENTATION', 1),
    (48, 10, 'Jetpack Compose Documentation', 'https://developer.android.com/develop/ui/compose', 'DOCUMENTATION', 2),
    (49, 10, 'Material Design for Android', 'https://m3.material.io/', 'DOCUMENTATION', 3),
    (50, 10, 'Kotlin Course (YouTube)', 'https://www.youtube.com/results?search_query=kotlin+android+development+full+course', 'VIDEO', 4),
    (51, 11, 'scikit-learn Documentation', 'https://scikit-learn.org/stable/', 'DOCUMENTATION', 0),
    (52, 11, 'TensorFlow Documentation', 'https://www.tensorflow.org/docs', 'DOCUMENTATION', 1),
    (53, 11, 'Kaggle Learn', 'https://www.kaggle.com/learn', 'COURSE', 2),
    (54, 11, 'Andrew Ng Machine Learning (YouTube)', 'https://www.youtube.com/results?search_query=andrew+ng+machine+learning+course', 'VIDEO', 3),
    (55, 11, 'MLflow Documentation', 'https://mlflow.org/docs/', 'DOCUMENTATION', 4);

-- ═══════════════════════════════════════════════════════════════════════════
-- Recommended mentor sessions (2 per career path; IDs 1–22)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO roadmap_sessions (id, career_path_id, title, description, duration_minutes, order_index) VALUES
    (1,  1, 'Java Interview Preparation', 'A mock-interview session focused on Java core, collections and problem solving.', 60, 0),
    (2,  1, 'Spring Boot Deep Dive', 'Build a production-grade REST service together and review best practices.', 90, 1),
    (3,  2, 'Spring Boot from Zero', 'Scaffold and ship your first Spring Boot REST API with an expert mentor.', 60, 0),
    (4,  2, 'Securing REST APIs with JWT', 'Walk through JWT auth and role-based access on a real project.', 90, 1),
    (5,  3, 'Building a Full Stack App', 'Ship a small MERN feature end-to-end with a mentor.', 90, 0),
    (6,  3, 'MERN Interview Prep', 'Practice full-stack coding and system questions for MERN roles.', 60, 1),
    (7,  4, 'React Components Masterclass', 'Deep-dive into component architecture and reusable UI patterns.', 60, 0),
    (8,  4, 'State Management with Hooks', 'Learn practical state management patterns beyond basics.', 60, 1),
    (9,  5, 'Express from Scratch', 'Build a REST API with Express, middleware and error handling.', 60, 0),
    (10, 5, 'Node.js Production Best Practices', 'Review real-world patterns for scaling Node services.', 90, 1),
    (11, 6, 'Python Fundamentals Workshop', 'Interactive workshop covering Python basics and best practices.', 60, 0),
    (12, 6, 'Build Your First Flask API', 'Create and deploy a Flask API with a mentor.', 60, 1),
    (13, 7, 'SQL for Analysts', 'Practice real-world SQL queries and analytics problems.', 60, 0),
    (14, 7, 'Storytelling with Data', 'Learn to frame insights that drive business decisions.', 60, 1),
    (15, 8, 'Docker Deep Dive', 'Containerize services and debug images with an expert.', 90, 0),
    (16, 8, 'CI/CD Pipeline from Scratch', 'Automate build, test and deployment with GitHub Actions.', 90, 1),
    (17, 9, 'Intro to Deep Learning', 'Understand neural networks and training fundamentals hands-on.', 60, 0),
    (18, 9, 'Deploying ML Models', 'Take a trained model to production with an API and monitoring.', 90, 1),
    (19, 10, 'Android UI with Compose', 'Build modern Compose screens and navigation with a mentor.', 60, 0),
    (20, 10, 'Publishing to Play Store', 'Prepare and release your first Android app.', 60, 1),
    (21, 11, 'ML Pipeline Best Practices', 'Review data, training and evaluation pipeline design.', 60, 0),
    (22, 11, 'Model Deployment Workshop', 'Deploy a model behind a production API and monitor it.', 90, 1);
