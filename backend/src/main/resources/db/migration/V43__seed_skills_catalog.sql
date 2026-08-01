-- Seed the skills catalog from the skill names actually used by user profiles.
--
-- The skills table (created in V1) was never populated — user profiles store
-- skills as JSON/TEXT on the users row, so the catalog, the admin skill
-- management module, and the dashboard "Total Skills" KPI all read an empty
-- table. This backfills the catalog with the distinct skills present in the
-- seeded user data so those features reflect real data.
--
-- Idempotent: INSERT IGNORE respects the unique name constraint, so re-running
-- (or running against a DB that already has some rows) is safe.

INSERT IGNORE INTO skills (name, category) VALUES
  ('React', 'Frontend'),
  ('TypeScript', 'Frontend'),
  ('Next.js', 'Frontend'),
  ('Node.js', 'Backend'),
  ('Java', 'Backend'),
  ('Python', 'Backend'),
  ('Spring Boot', 'Backend'),
  ('PostgreSQL', 'Database'),
  ('SQL', 'Database'),
  ('System Design', 'Architecture'),
  ('Microservices', 'Architecture'),
  ('Docker', 'DevOps'),
  ('Kubernetes', 'DevOps'),
  ('AWS', 'DevOps'),
  ('CI/CD', 'DevOps'),
  ('Terraform', 'DevOps'),
  ('DevOps', 'DevOps'),
  ('Machine Learning', 'AI/ML'),
  ('TensorFlow', 'AI/ML'),
  ('Data Science', 'Data Science'),
  ('Full Stack', 'Full Stack'),
  ('Platform Management', 'Management'),
  ('Community Moderation', 'Management'),
  ('Strategic Planning', 'Management');
