-- ═══════════════════════════════════════════════════════════════════════════
-- V63 — Learner Daily Tasks
--
-- Replaces the removed roadmap concept with a mentor-led "Daily Tasks" system.
-- Tasks are fully learner-owned, stored in the database and scoped per learner:
--
--   learner_tasks — one learner's personal task list. Tasks can be created by
--                   the learner (PERSONAL / PRACTICE / READING / …) or
--                   generated deterministically from real session activity
--                   (SESSION_FOLLOWUP / NOTE_REVIEW) — never from AI.
--
-- Status is stored as TODO / IN_PROGRESS / COMPLETED / CANCELLED. "OVERDUE" is
-- derived at read time (due date passed and not completed), so no scheduler is
-- needed to flip rows.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE learner_tasks (
    id                  BIGINT PRIMARY KEY AUTO_INCREMENT,
    learner_id          BIGINT NOT NULL,
    title               VARCHAR(200) NOT NULL,
    description         TEXT NULL,
    task_type           VARCHAR(32) NOT NULL DEFAULT 'PERSONAL',
    priority            VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    status              VARCHAR(16) NOT NULL DEFAULT 'TODO',
    due_date            DATETIME(6) NULL,
    completed_at        DATETIME(6) NULL,
    related_session_id  BIGINT NULL,
    related_mentor_id   BIGINT NULL,
    is_system_generated BOOLEAN NOT NULL DEFAULT FALSE,
    reminder_at         DATETIME(6) NULL,
    created_at          DATETIME(6) NOT NULL,
    updated_at          DATETIME(6) NOT NULL,
    CONSTRAINT fk_ltask_learner FOREIGN KEY (learner_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_ltask_learner ON learner_tasks (learner_id);
CREATE INDEX idx_ltask_learner_status ON learner_tasks (learner_id, status);
CREATE INDEX idx_ltask_learner_due ON learner_tasks (learner_id, due_date);
