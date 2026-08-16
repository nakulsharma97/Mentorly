-- ══════════════════════════════════════════════════════════════════════════
-- Public / Private 1:1 session visibility
--
-- SkillSwap is a 1:1 mentoring marketplace. Every session instance may be
-- booked by AT MOST ONE learner. This migration introduces the visibility
-- taxonomy on the existing `sessions.session_type` column:
--
--   PUBLIC   → discoverable by any eligible learner while available
--   PRIVATE  → created for exactly ONE learner (sessions.target_learner_id)
--
-- Legacy delivery-type values ("ONLINE", "1:1 Mentoring", "LIVE_SESSION", …)
-- are normalized to PUBLIC. Sessions that were created from an accepted
-- learner request were always tied to a single learner, so they become
-- PRIVATE with the requesting learner as the target.
-- ══════════════════════════════════════════════════════════════════════════

ALTER TABLE sessions ADD COLUMN target_learner_id BIGINT NULL;

ALTER TABLE sessions
    ADD CONSTRAINT fk_sessions_target_learner
        FOREIGN KEY (target_learner_id) REFERENCES users(id);

CREATE INDEX idx_sessions_target_learner ON sessions(target_learner_id);

-- Normalize any legacy delivery-type value into the PUBLIC visibility class.
UPDATE sessions
SET session_type = 'PUBLIC'
WHERE session_type NOT IN ('PUBLIC', 'PRIVATE');

-- Sessions materialized from an accepted learner request belong to that ONE
-- learner → mark them PRIVATE and point them at the requesting learner.
UPDATE sessions
SET session_type = 'PRIVATE',
    target_learner_id = (
        SELECT r.learner_id
        FROM session_requests r
        WHERE r.session_id = sessions.id
        LIMIT 1
    )
WHERE target_learner_id IS NULL
  AND session_type = 'PUBLIC'
  AND EXISTS (
      SELECT 1 FROM session_requests r WHERE r.session_id = sessions.id
  );
