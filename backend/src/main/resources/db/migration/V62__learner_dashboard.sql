-- ═══════════════════════════════════════════════════════════════════════════
-- V62 — Learner dashboard (session-based "My Learning")
--
-- The My Learning page is a session-centred dashboard built entirely from real
-- bookings / sessions / certifications. Two new per-learner tables power the
-- two personal features the dashboard owns:
--
--   learner_todos   — each learner's private todo list (add / edit / complete /
--                     delete). Todos are independent per learner.
--   session_notes   — a learner's private notes attached to one of their
--                     bookings (one note per booking per learner). Backs the
--                     "View Notes" / "Notes" column in the session history.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE learner_todos (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    learner_id  BIGINT NOT NULL,
    task        VARCHAR(500) NOT NULL,
    done        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  DATETIME(6) NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    CONSTRAINT fk_lt_learner FOREIGN KEY (learner_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_lt_learner ON learner_todos (learner_id);

CREATE TABLE session_notes (
    id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    booking_id  BIGINT NOT NULL,
    learner_id  BIGINT NOT NULL,
    content     TEXT NOT NULL,
    created_at  DATETIME(6) NOT NULL,
    updated_at  DATETIME(6) NOT NULL,
    CONSTRAINT fk_sn_booking FOREIGN KEY (booking_id) REFERENCES bookings (id),
    CONSTRAINT fk_sn_learner FOREIGN KEY (learner_id) REFERENCES users (id),
    CONSTRAINT uq_sn_booking_learner UNIQUE (booking_id, learner_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4;

CREATE INDEX idx_sn_learner ON session_notes (learner_id);
