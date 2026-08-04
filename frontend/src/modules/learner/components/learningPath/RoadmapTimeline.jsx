import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { milestoneStatus } from "./data";
import { SectionHeader, Reveal } from "./ui";

const DIFFICULTY_STYLE = {
  Beginner: { label: "Beginner", color: "#10b981", bg: "rgba(16,185,129,0.12)" },
  Intermediate: { label: "Intermediate", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  Advanced: { label: "Advanced", color: "#f43f5e", bg: "rgba(244,63,94,0.12)" },
  Career: { label: "Career", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
};

/**
 * Expansible milestone detail card — resources, videos, docs, practice links,
 * assignments and the mini project for the topic.
 */
export function MilestoneCard({ milestone, status, onToggle, expanded, onExpand, progress }) {
  const statusMeta = {
    completed: { label: "Completed", icon: "check_circle", color: "#10b981" },
    current: { label: "In Progress", icon: "radio_button_checked", color: "#3b82f6" },
    upcoming: { label: "Up Next", icon: "play_circle", color: "#f59e0b" },
    locked: { label: "Locked", icon: "lock", color: "#94a3b8" },
  }[status];
  const diff = DIFFICULTY_STYLE[milestone.difficulty] || DIFFICULTY_STYLE.Intermediate;
  const clickable = status !== "locked";

  return (
    <motion.article
      layout="position"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={`lp-milestone is-${status}${expanded ? " is-expanded" : ""}`}
    >
      <div
        className="lp-milestone__main"
        role={clickable ? "button" : undefined}
        tabIndex={clickable ? 0 : undefined}
        aria-expanded={clickable ? expanded : undefined}
        onClick={clickable ? onExpand : undefined}
        onKeyDown={(e) => {
          if (clickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onExpand();
          }
        }}
      >
        <span className="lp-milestone__dot">
          {status === "completed" ? (
            <Icon name="check" />
          ) : status === "current" ? (
            <Icon name="radio_button_checked" />
          ) : status === "upcoming" ? (
            <Icon name="play_arrow" />
          ) : (
            <Icon name="lock" />
          )}
        </span>

        <span className="lp-milestone__icon" style={{ color: statusMeta.color, background: `${statusMeta.color}1f` }}>
          <Icon name={milestone.icon || "school"} />
        </span>

        <div className="lp-milestone__body">
          <div className="lp-milestone__title-row">
            <h3 className="lp-milestone__title">{milestone.title}</h3>
            <span className="lp-milestone__diff" style={{ color: diff.color, background: diff.bg }}>
              {diff.label}
            </span>
            <span className="lp-milestone__eta">
              <Icon name="schedule" /> ~{milestone.weeks} wk{milestone.weeks > 1 ? "s" : ""}
            </span>
          </div>
          <p className="lp-milestone__desc">{milestone.description}</p>

          <div className="lp-milestone__foot">
            <span className="lp-milestone__status" style={{ color: statusMeta.color }}>
              <Icon name={statusMeta.icon} /> {statusMeta.label}
            </span>
            {status !== "locked" && (
              <span className="lp-milestone__skills">
                {milestone.skills.slice(0, 3).map((s) => (
                  <em key={s}>{s}</em>
                ))}
              </span>
            )}
            <span className="lp-milestone__toggle">
              {expanded ? "Close details" : "View resources"} <Icon name={expanded ? "expand_less" : "expand_more"} />
            </span>
          </div>
        </div>

        {status === "current" && (
          <span className="lp-milestone__now">
            <Icon name="auto_awesome" /> Now
          </span>
        )}
      </div>

      {status !== "locked" && (
        <button
          type="button"
          className={`lp-milestone__check lp-milestone__check--float${status === "completed" ? " is-checked" : ""}`}
          onClick={onToggle}
          aria-label={`Mark ${milestone.title} ${status === "completed" ? "incomplete" : "complete"}`}
          aria-pressed={status === "completed"}
        >
          <span className="lp-milestone__checkmark">
            <Icon name="check" />
          </span>
        </button>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="lp-milestone__detail"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lp-milestone__detail-inner">
              <div className="lp-milestone__detail-grid">
                <div className="lp-milestone__block">
                  <h4><Icon name="smart_display" /> Videos</h4>
                  <ul>{milestone.resources.videos.map((v) => <li key={v}>{v}</li>)}</ul>
                </div>
                <div className="lp-milestone__block">
                  <h4><Icon name="description" /> Docs</h4>
                  <ul>{milestone.resources.docs.map((d) => <li key={d}>{d}</li>)}</ul>
                </div>
                <div className="lp-milestone__block">
                  <h4><Icon name="menu_book" /> Books</h4>
                  <ul>{milestone.resources.books.map((b) => <li key={b}>{b}</li>)}</ul>
                </div>
                <div className="lp-milestone__block">
                  <h4><Icon name="quiz" /> Practice</h4>
                  <ul>{milestone.resources.practice.map((p) => <li key={p}>{p}</li>)}</ul>
                </div>
              </div>
              <div className="lp-milestone__assignments">
                <div className="lp-milestone__block lp-milestone__block--tasks">
                  <h4><Icon name="assignment" /> Assignments</h4>
                  <ul>{milestone.tasks.map((t) => <li key={t}>{t}</li>)}</ul>
                </div>
                <div className="lp-milestone__block lp-milestone__block--project">
                  <h4><Icon name="construction" /> Mini Project</h4>
                  <p>{milestone.project}</p>
                  <Link to="/learner/mentors" className="lp-btn lp-btn--sm lp-btn--outline">
                    <Icon name="person_search" /> Find a mentor for this
                  </Link>
                </div>
              </div>
              {status === "current" && (
                <div className="lp-milestone__progress">
                  <span>Milestone progress</span>
                  <div className="lp-bar">
                    <motion.div
                      className="lp-bar__fill"
                      initial={{ width: 0 }}
                      whileInView={{ width: `${progress}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.9, ease: "easeOut" }}
                    />
                  </div>
                  <strong>{progress}%</strong>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/**
 * Interactive roadmap timeline — connected progress line, animated nodes and
 * expandable milestones that guide the learner Beginner → Job Ready.
 */
export default function RoadmapTimeline({ milestones, progressPercent, onToggleMilestone }) {
  const [expanded, setExpanded] = useState(null);
  const total = milestones.length;
  const progress = Math.round(Number(progressPercent || 0));
  const completedCount = Math.round((total * progress) / 100);

  const derived = useMemo(
    () =>
      milestones.map((m, index) => ({
        ...m,
        status: milestoneStatus(index, total, progressPercent),
      })),
    [milestones, total, progressPercent],
  );

  return (
    <section className="lp-section" aria-label="Career roadmap">
      <Reveal>
        <SectionHeader
          icon="timeline"
          title="Your Career Roadmap"
          subtitle={`${completedCount} of ${total} milestones complete — ${progress}% toward job-ready`}
        />
      </Reveal>

      <Reveal delay={0.05}>
        <div className="lp-roadmap">
          <div className="lp-roadmap__track" aria-hidden="true">
            <motion.div
              className="lp-roadmap__track-fill"
              initial={{ height: 0 }}
              whileInView={{ height: `${Math.max(2, (completedCount / Math.max(1, total)) * 100)}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.4, ease: "easeOut" }}
            />
          </div>

          <div className="lp-roadmap__items">
            {derived.map((m) => (
              <MilestoneCard
                key={m.id}
                milestone={m}
                status={m.status}
                progress={progress}
                expanded={expanded === m.id}
                onExpand={() => setExpanded(expanded === m.id ? null : m.id)}
                onToggle={() => onToggleMilestone?.(m.index)}
              />
            ))}
          </div>
        </div>
      </Reveal>
    </section>
  );
}
