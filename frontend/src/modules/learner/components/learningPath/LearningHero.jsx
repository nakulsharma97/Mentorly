import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { greetingByHour } from "./data";
import { ProgressRing } from "./ui";

/**
 * Flagship hero: dark navy → blue → emerald gradient, greeting, career goal,
 * progress ring, floating achievement badges and milestone chips.
 */
export default function LearningHero({
  profile,
  careerGoal,
  overallProgress,
  streak,
  totalHours,
  certifications,
  skillLevel,
  weeksLeft,
  currentMilestone,
  hasRoadmap,
}) {
  const firstName =
    profile?.fullName?.trim()?.split(/\s+/)[0] ||
    profile?.username ||
    "Learner";
  const greeting = greetingByHour();

  return (
    <section className="lp-hero" aria-label="Learning overview">
      <div className="lp-hero__glow lp-hero__glow--1" />
      <div className="lp-hero__glow lp-hero__glow--2" />
      <div className="lp-hero__grid" />

      <div className="lp-hero__layout">
        {/* Left: greeting + goal + CTAs */}
        <div className="lp-hero__left">
          <motion.span
            className="lp-hero__greeting"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Icon name="waving_hand" /> {greeting}, {firstName} 👋
          </motion.span>

          <motion.h1
            className="lp-hero__title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08 }}
          >
            {careerGoal || "Start Your Learning Journey"}
          </motion.h1>

          <motion.p
            className="lp-hero__sub"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16 }}
          >
            {currentMilestone
              ? `Currently mastering ${currentMilestone.title} — you're ${weeksLeft} weeks from being job-ready.`
              : "Every expert was once a beginner. Map your path and learn with mentors who've been there."}
          </motion.p>

          <motion.div
            className="lp-hero__chips"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24 }}
          >
            <span className="lp-hero__chip">
              <Icon name="local_fire_department" />
              <strong>{streak}d</strong> streak
            </span>
            <span className="lp-hero__chip">
              <Icon name="schedule" />
              <strong>{totalHours}h</strong> learned
            </span>
            <span className="lp-hero__chip">
              <Icon name="workspace_premium" />
              <strong>{certifications.length}</strong> cert{certifications.length === 1 ? "" : "s"}
            </span>
            <span className="lp-hero__chip">
              <Icon name="signal_cellular_alt" />
              <strong>{skillLevel}</strong> level
            </span>
          </motion.div>

          <motion.div
            className="lp-hero__actions"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.32 }}
          >
            <Link to={hasRoadmap ? "/learner/path" : "/learner/mentors"} className="lp-btn lp-btn--hero">
              <Icon name="play_circle" /> Continue Learning
            </Link>
            <Link to="/learner/skills" className="lp-btn lp-btn--ghost-hero">
              <Icon name="flag" /> Change Goal
            </Link>
          </motion.div>
        </div>

        {/* Right: animated progress stage */}
        <div className="lp-hero__right" aria-hidden="true">
          <motion.div
            className="lp-hero__stage"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="lp-hero__road" />
            <div className="lp-hero__road-dots">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className={i < Math.round((overallProgress / 100) * 9) ? "is-lit" : ""} />
              ))}
            </div>

            {/* Floating badge 1 */}
            <motion.span
              className="lp-hero__float"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              🏆
            </motion.span>
            {/* Floating badge 2 */}
            <motion.span
              className="lp-hero__float lp-hero__float--2"
              animate={{ y: [0, 7, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            >
              ⚡
            </motion.span>
            {/* Floating badge 3 */}
            <motion.span
              className="lp-hero__float lp-hero__float--3"
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut", delay: 1.1 }}
            >
              🚀
            </motion.span>

            <div className="lp-hero__ring-card">
              <ProgressRing value={overallProgress} size={116} stroke={9} label="Journey" sublabel={`${weeksLeft} wks left`} id="lpHeroRing" />
            </div>

            <motion.div
              className="lp-hero__milestone-card"
              initial={{ opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <span className="lp-hero__milestone-emoji">🎯</span>
              <div>
                <strong>{currentMilestone ? currentMilestone.title : "Java Basics"}</strong>
                <span>{hasRoadmap ? "Current milestone" : "Suggested start"}</span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
