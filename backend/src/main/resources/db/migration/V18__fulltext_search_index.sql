ALTER TABLE users
    ADD FULLTEXT INDEX idx_mentor_fulltext (full_name, about_me, skills);