-- Insert test users for authentication testing
-- Password for both test users: password
-- Hash generated with BCryptPasswordEncoder (cost 12)

INSERT INTO users (email, password_hash, role, full_name, enabled, created_at)
VALUES 
  ('mentor@test.com', '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS', 'MENTOR', 'Test Mentor', TRUE, CURRENT_TIMESTAMP),
  ('learner@test.com', '$2b$12$eqUeoZHM2YjitmaQTeKEke7lbyb77rh3wGQa0FxrohXxZN.QuZ9tS', 'LEARNER', 'Test Learner', TRUE, CURRENT_TIMESTAMP);

-- To generate a new BCrypt hash, run:
--   cd frontend && node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('your-password', 12).then(h => console.log(h));"
