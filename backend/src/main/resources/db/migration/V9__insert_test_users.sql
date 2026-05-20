-- Insert test users for authentication testing
-- Password: test@123 (BCrypt hash)

INSERT INTO users (email, password_hash, role, full_name, enabled, created_at)
VALUES 
  ('mentor@test.com', '$2a$10$slYQmyNdGzin7olVN3p5Be7DlH.PKZbv5H8KnzzVgXXbVxzy990P2', 'MENTOR', 'Test Mentor', TRUE, CURRENT_TIMESTAMP),
  ('learner@test.com', '$2a$10$slYQmyNdGzin7olVN3p5Be7DlH.PKZbv5H8KnzzVgXXbVxzy990P2', 'LEARNER', 'Test Learner', TRUE, CURRENT_TIMESTAMP);

-- Note: Password for both test users is "password" (commonly used for testing)
-- To generate BCrypt hashes, use: https://www.bcryptcalculator.com/
-- Or Spring CLI: spring-shell> hash [plain-text-password]
