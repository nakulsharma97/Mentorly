-- ═══════════════════════════════════════════════════════════════
-- Dev-only seed: rich sample mentor/learner profiles
-- ═══════════════════════════════════════════════════════════════
-- Executed ONLY by DevDataSeeder, which is active only for the
-- @Profile({"dev","local"}) Spring profiles. Production/staging NEVER
-- runs this file — V50__purge_seeded_demo_data.sql removes this data
-- everywhere else.
--
-- Creates 5 mentors and 2 learners with realistic profile data,
-- sample sessions, completed bookings, and mentor reviews.
-- All accounts share the well-known dev password hash (see V9) —
-- acceptable for local development only.
--
-- Prerequisite: dev-test-users.sql has already run (mentor@test.com /
-- learner@test.com exist), mirroring the original V9/V39 ordering.
-- ═══════════════════════════════════════════════════════════════

-- ── Sample Mentors ───────────────────────────────────────────

INSERT IGNORE INTO users (email, username, password_hash, role, full_name, enabled, mentor_verified, skills, about_me, github_url, linkedin_url, projects, certificates, past_teaching_sessions, years_of_experience, hourly_rate, company, headline, referral_code, created_at, last_active_at)
VALUES
(
  'priya.sharma@example.com',
  'priyadev',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'MENTOR',
  'Priya Sharma',
  TRUE,
  TRUE,
  '[{"name":"React"},{"name":"TypeScript"},{"name":"Node.js"},{"name":"System Design"}]',
  'Senior frontend engineer with 8+ years building scalable web applications. Passionate about mentoring developers who want to level up their React and TypeScript skills.',
  'https://github.com/priyadev',
  'https://linkedin.com/in/priyadev',
  'Led migration of monolith to micro-frontends at a fintech startup — reduced deployment time by 70%',
  'AWS Certified Developer – Associate, Meta Frontend Developer Certificate',
  'Mentored 30+ junior developers through structured 8-week React bootcamps. Conducted 50+ mock system design interviews.',
  8,
  80.00,
  'Stripe',
  'Senior Frontend Engineer & Architecture Coach',
  'PRIYA001',
  CURRENT_TIMESTAMP - INTERVAL 120 DAY,
  CURRENT_TIMESTAMP - INTERVAL 2 HOUR
),
(
  'raj.patel@example.com',
  'rajml',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'MENTOR',
  'Raj Patel',
  TRUE,
  TRUE,
  '[{"name":"Python"},{"name":"Machine Learning"},{"name":"TensorFlow"},{"name":"Data Science"}]',
  'ML engineer with experience deploying production models at scale. I help learners bridge the gap between Jupyter notebooks and production ML pipelines.',
  'https://github.com/rajml',
  'https://linkedin.com/in/rajml',
  'Built real-time fraud detection system processing 10K+ transactions/sec with 99.7% accuracy',
  'Google Cloud Professional ML Engineer, TensorFlow Developer Certificate',
  'Taught "ML in Production" course to 200+ students at General Assembly. Regular speaker at PyData conferences.',
  6,
  90.00,
  'Google',
  'ML Engineer & Production AI Mentor',
  'RAJ002',
  CURRENT_TIMESTAMP - INTERVAL 90 DAY,
  CURRENT_TIMESTAMP - INTERVAL 30 MINUTE
),
(
  'sarah.chen@example.com',
  'sarahcodes',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'MENTOR',
  'Sarah Chen',
  TRUE,
  TRUE,
  '[{"name":"Java"},{"name":"Spring Boot"},{"name":"Microservices"},{"name":"Kubernetes"}]',
  'Backend infrastructure engineer who loves breaking down complex distributed systems into teachable pieces.',
  'https://github.com/sarahcodes',
  'https://linkedin.com/in/sarahcodes',
  'Architected multi-region Kubernetes platform serving 5M+ daily active users across 12 regions',
  'CKAD, CKA, AWS Solutions Architect – Professional',
  'Led 40+ engineering workshops on distributed systems. Mentored 15 engineers through the CKAD certification process.',
  10,
  100.00,
  'Netflix',
  'Staff Backend Engineer & Distributed Systems Mentor',
  'SARAH003',
  CURRENT_TIMESTAMP - INTERVAL 60 DAY,
  CURRENT_TIMESTAMP - INTERVAL 1 HOUR
),
(
  'amit.kumar@example.com',
  'amitfullstack',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'MENTOR',
  'Amit Kumar',
  TRUE,
  TRUE,
  '[{"name":"Full Stack"},{"name":"Next.js"},{"name":"PostgreSQL"},{"name":"Docker"}]',
  'Full-stack developer who enjoys mentoring early-career developers build market-ready skills.',
  'https://github.com/amitfullstack',
  'https://linkedin.com/in/amitfullstack',
  'Built and scaled a SaaS platform from 0 to 10K paid users as solo technical founder',
  'HashiCorp Terraform Associate, MongoDB Developer',
  'Ran a 12-week "Build Your Startup" bootcamp where 8 teams shipped and launched MVPs.',
  7,
  65.00,
  'Freelance',
  'Full-Stack Developer & Startup Mentor',
  'AMIT004',
  CURRENT_TIMESTAMP - INTERVAL 45 DAY,
  CURRENT_TIMESTAMP - INTERVAL 4 HOUR
),
(
  'emma.wilson@example.com',
  'emmadevops',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'MENTOR',
  'Emma Wilson',
  TRUE,
  TRUE,
  '[{"name":"DevOps"},{"name":"AWS"},{"name":"CI/CD"},{"name":"Terraform"}]',
  'DevOps engineer passionate about infrastructure as code and building resilient cloud architectures.',
  'https://github.com/emmadevops',
  'https://linkedin.com/in/emmadevops',
  'Designed and implemented GitOps workflow reducing deployment failures by 95% across 200+ microservices',
  'AWS DevOps Engineer – Professional, HashiCorp Vault Associate',
  'Delivered "AWS for Developers" workshop series at 8 tech conferences. Mentored 25+ career switchers into DevOps roles.',
  9,
  85.00,
  'Amazon Web Services',
  'DevOps Architect & Cloud Infrastructure Mentor',
  'EMMA005',
  CURRENT_TIMESTAMP - INTERVAL 30 DAY,
  CURRENT_TIMESTAMP - INTERVAL 10 MINUTE
);

-- ── Sample Learners ──────────────────────────────────────────

INSERT IGNORE INTO users (email, username, password_hash, role, full_name, enabled, skills, about_me, referral_code, created_at, last_active_at)
VALUES
(
  'alex.johnson@example.com',
  'alexlearner',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'LEARNER',
  'Alex Johnson',
  TRUE,
  '[{"name":"React"},{"name":"Node.js"}]',
  'Junior developer looking to level up from building basic CRUD apps to designing production-ready systems.',
  'ALEX006',
  CURRENT_TIMESTAMP - INTERVAL 14 DAY,
  CURRENT_TIMESTAMP - INTERVAL 1 DAY
),
(
  'maria.garcia@example.com',
  'mariadata',
  '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS',
  'LEARNER',
  'Maria Garcia',
  TRUE,
  '[{"name":"Python"},{"name":"SQL"}]',
  'Career switcher transitioning from finance to data science. Building ML portfolio with real-world datasets.',
  'MARIA007',
  CURRENT_TIMESTAMP - INTERVAL 7 DAY,
  CURRENT_TIMESTAMP - INTERVAL 12 HOUR
);

-- ── Sample Sessions ──────────────────────────────────────────

INSERT INTO sessions (mentor_id, title, description, price_amount, session_type, status, max_participants, start_time, end_time, created_at)
SELECT u.id, 'React Performance Optimization', 'Deep dive into React rendering behavior, memo strategies, and bundle optimization techniques.', 80.00, 'ONE_ON_ONE', 'ACCEPTED', 1, CURRENT_TIMESTAMP + INTERVAL 2 DAY, CURRENT_TIMESTAMP + INTERVAL 2 DAY + INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 30 DAY
FROM users u WHERE u.email = 'priya.sharma@example.com'
AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.title = 'React Performance Optimization' AND s.mentor_id = u.id);

INSERT INTO sessions (mentor_id, title, description, price_amount, session_type, status, max_participants, start_time, end_time, created_at)
SELECT u.id, 'System Design: Social Media Platform', 'Design Twitter-scale social media platform. Covers sharding, caching, feed generation, and real-time features.', 80.00, 'ONE_ON_ONE', 'ACCEPTED', 1, CURRENT_TIMESTAMP + INTERVAL 5 DAY, CURRENT_TIMESTAMP + INTERVAL 5 DAY + INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 25 DAY
FROM users u WHERE u.email = 'priya.sharma@example.com'
AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.title = 'System Design: Social Media Platform' AND s.mentor_id = u.id);

INSERT INTO sessions (mentor_id, title, description, price_amount, session_type, status, max_participants, start_time, end_time, created_at)
SELECT u.id, 'ML Model Deployment on GCP', 'End-to-end ML deployment pipeline: model serving, A/B testing, monitoring, and auto-scaling with Vertex AI.', 90.00, 'ONE_ON_ONE', 'ACCEPTED', 1, CURRENT_TIMESTAMP + INTERVAL 3 DAY, CURRENT_TIMESTAMP + INTERVAL 3 DAY + INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 20 DAY
FROM users u WHERE u.email = 'raj.patel@example.com'
AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.title = 'ML Model Deployment on GCP' AND s.mentor_id = u.id);

INSERT INTO sessions (mentor_id, title, description, price_amount, session_type, status, max_participants, start_time, end_time, created_at)
SELECT u.id, 'Kubernetes for Developers', 'From Pods to Operators: practical Kubernetes for developers who want to understand container orchestration deeply.', 100.00, 'ONE_ON_ONE', 'ACCEPTED', 1, CURRENT_TIMESTAMP + INTERVAL 7 DAY, CURRENT_TIMESTAMP + INTERVAL 7 DAY + INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 15 DAY
FROM users u WHERE u.email = 'sarah.chen@example.com'
AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.title = 'Kubernetes for Developers' AND s.mentor_id = u.id);

INSERT INTO sessions (mentor_id, title, description, price_amount, session_type, status, max_participants, start_time, end_time, created_at)
SELECT u.id, 'Full-Stack SaaS Architecture', 'Build a subscription-based SaaS from scratch: Next.js, PostgreSQL, Stripe integration, and Docker deployment.', 65.00, 'ONE_ON_ONE', 'ACCEPTED', 1, CURRENT_TIMESTAMP + INTERVAL 4 DAY, CURRENT_TIMESTAMP + INTERVAL 4 DAY + INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 10 DAY
FROM users u WHERE u.email = 'amit.kumar@example.com'
AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.title = 'Full-Stack SaaS Architecture' AND s.mentor_id = u.id);

INSERT INTO sessions (mentor_id, title, description, price_amount, session_type, status, max_participants, start_time, end_time, created_at)
SELECT u.id, 'AWS DevOps Certification Prep', 'Comprehensive preparation for AWS DevOps Engineer Professional exam. Covers all domains with practice questions.', 85.00, 'ONE_ON_ONE', 'ACCEPTED', 1, CURRENT_TIMESTAMP + INTERVAL 6 DAY, CURRENT_TIMESTAMP + INTERVAL 6 DAY + INTERVAL 1 HOUR, CURRENT_TIMESTAMP - INTERVAL 5 DAY
FROM users u WHERE u.email = 'emma.wilson@example.com'
AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.title = 'AWS DevOps Certification Prep' AND s.mentor_id = u.id);

-- ── Sample Bookings (COMPLETED, to enable reviews) ───────────

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 60 DAY
FROM sessions s, users u
WHERE s.title = 'React Performance Optimization' AND u.email = 'alex.johnson@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 45 DAY
FROM sessions s, users u
WHERE s.title = 'React Performance Optimization' AND u.email = 'maria.garcia@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 30 DAY
FROM sessions s, users u
WHERE s.title = 'ML Model Deployment on GCP' AND u.email = 'alex.johnson@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 20 DAY
FROM sessions s, users u
WHERE s.title = 'ML Model Deployment on GCP' AND u.email = 'maria.garcia@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 15 DAY
FROM sessions s, users u
WHERE s.title = 'Kubernetes for Developers' AND u.email = 'alex.johnson@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 10 DAY
FROM sessions s, users u
WHERE s.title = 'Full-Stack SaaS Architecture' AND u.email = 'maria.garcia@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

INSERT INTO bookings (session_id, learner_id, booking_status, payment_status, created_at)
SELECT s.id, u.id, 'COMPLETED', 'RELEASED', CURRENT_TIMESTAMP - INTERVAL 5 DAY
FROM sessions s, users u
WHERE s.title = 'AWS DevOps Certification Prep' AND u.email = 'alex.johnson@example.com'
AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.learner_id = u.id);

-- ── Sample Mentor Reviews ────────────────────────────────────
-- Each review must reference a UNIQUE booking_id (constraint).
-- Joins through sessions to ensure each review gets a distinct booking
-- belonging to the correct mentor and learner pair.

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT p.id, a.id, b.id, 5, 'Priya is an incredible mentor. She took the time to understand my career goals and tailored each session around real problems I would face in production. Her system design sessions were mind-opening.', CURRENT_TIMESTAMP - INTERVAL 60 DAY
FROM users p, users a, bookings b JOIN sessions s ON b.session_id = s.id
WHERE p.email = 'priya.sharma@example.com'
  AND a.email = 'alex.johnson@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = a.id
  AND s.mentor_id = p.id
  AND s.title = 'React Performance Optimization'
LIMIT 1;

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT p.id, m.id, b.id, 4, 'Very structured approach to teaching React best practices. The hands-on code reviews were the most valuable part.', CURRENT_TIMESTAMP - INTERVAL 45 DAY
FROM users p, users m, bookings b JOIN sessions s ON b.session_id = s.id
WHERE p.email = 'priya.sharma@example.com'
  AND m.email = 'maria.garcia@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = m.id
  AND s.mentor_id = p.id
  AND s.title = 'System Design: Social Media Platform'
LIMIT 1;

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT r.id, a.id, b.id, 5, 'Raj made ML concepts that felt overwhelming suddenly click. His production deployment walkthrough was exactly what I needed to understand MLOps.', CURRENT_TIMESTAMP - INTERVAL 30 DAY
FROM users r, users a, bookings b JOIN sessions s ON b.session_id = s.id
WHERE r.email = 'raj.patel@example.com'
  AND a.email = 'alex.johnson@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = a.id
  AND s.mentor_id = r.id
  AND s.title = 'ML Model Deployment on GCP'
LIMIT 1;

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT r.id, m.id, b.id, 5, 'The fraud detection case study was fascinating. Raj explains complex algorithms in a way that makes them feel approachable.', CURRENT_TIMESTAMP - INTERVAL 20 DAY
FROM users r, users m, bookings b JOIN sessions s ON b.session_id = s.id
WHERE r.email = 'raj.patel@example.com'
  AND m.email = 'maria.garcia@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = m.id
  AND s.mentor_id = r.id
  AND s.title = 'ML Model Deployment on GCP'
LIMIT 1;

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT s.id, a.id, b.id, 4, 'Sarahs system design sessions are world-class. She uses real Netflix examples which makes abstract concepts concrete.', CURRENT_TIMESTAMP - INTERVAL 15 DAY
FROM users s, users a, bookings b JOIN sessions ses ON b.session_id = ses.id
WHERE s.email = 'sarah.chen@example.com'
  AND a.email = 'alex.johnson@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = a.id
  AND ses.mentor_id = s.id
  AND ses.title = 'Kubernetes for Developers'
LIMIT 1;

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT am.id, m.id, b.id, 5, 'Amits project-based approach is exactly what I needed. We built and deployed a full-stack app together over 6 sessions.', CURRENT_TIMESTAMP - INTERVAL 10 DAY
FROM users am, users m, bookings b JOIN sessions s ON b.session_id = s.id
WHERE am.email = 'amit.kumar@example.com'
  AND m.email = 'maria.garcia@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = m.id
  AND s.mentor_id = am.id
  AND s.title = 'Full-Stack SaaS Architecture'
LIMIT 1;

INSERT INTO mentor_reviews (mentor_id, learner_id, booking_id, rating, comment, created_at)
SELECT e.id, a.id, b.id, 5, 'Emma helped me transition from a junior dev role into a DevOps engineer position. Her Terraform workshops were incredibly valuable.', CURRENT_TIMESTAMP - INTERVAL 5 DAY
FROM users e, users a, bookings b JOIN sessions s ON b.session_id = s.id
WHERE e.email = 'emma.wilson@example.com'
  AND a.email = 'alex.johnson@example.com'
  AND b.booking_status = 'COMPLETED'
  AND b.learner_id = a.id
  AND s.mentor_id = e.id
  AND s.title = 'AWS DevOps Certification Prep'
LIMIT 1;
