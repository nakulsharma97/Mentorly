-- ═════════════════════════════════════════════════════════════════════════════
--  Favorite Mentors — query index
--
--  The saved_mentors table (created in V5) already enforces uniqueness via
--  uq_saved_mentor (learner_id, mentor_id), so duplicate favorites are
--  impossible at the database level. This migration adds a covering index for
--  the "list this learner's favorites" query (the composite unique key already
--  serves the learner_id prefix, but the (learner_id, created_at) index keeps
--  the favorites list / saved-mentors page ordering cheap as the table grows).
-- ═════════════════════════════════════════════════════════════════════════════

CREATE INDEX idx_saved_mentors_learner_created
    ON saved_mentors (learner_id, created_at);
