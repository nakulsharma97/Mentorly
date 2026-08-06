import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { greetingByHour } from "./data";
import { ProgressRing } from "./ui";
import HeroSection from "../../../../components/HeroSection";

/**
 * LearningHero — Learning Path flagship hero. Delegates to the shared
 * <HeroSection /> so the page renders the exact same gradient / radius /
 * spacing / buttons as every other SkillSwap page hero. The animated
 * progress ring + milestone card live inside the fixed 260×260 art box; the
 * streak / hours / certs / level chips render as the hero action row.
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
    <HeroSection
      badge={
        <>
          <Icon name="waving_hand" /> {greeting}, {firstName}
        </>
      }
      title={careerGoal || "Start Your Learning Journey"}
      subtitle={
        currentMilestone
          ? `Currently mastering ${currentMilestone.title} — you're ${weeksLeft} weeks from being job-ready.`
          : "Every expert was once a beginner. Map your path and learn with mentors who've been there."
      }
      primaryButton={
        <Link
          to={hasRoadmap ? "/learner/path" : "/learner/mentors"}
          className="hero-section__btn hero-section__btn--primary"
        >
          <Icon name="play_circle" /> Continue Learning
        </Link>
      }
      secondaryButton={
        <Link
          to="/learner/skills"
          className="hero-section__btn hero-section__btn--secondary"
        >
          <Icon name="flag" /> Change Goal
        </Link>
      }
      illustration={
        <div
          className="lp-hero__stage lp-hero__stage--shared"
          aria-hidden="true"
        >
          <div className="lp-hero__road" />
          <div className="lp-hero__road-dots">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className={
                  i < Math.round((overallProgress / 100) * 9) ? "is-lit" : ""
                }
              />
            ))}
          </div>

          {/* Floating badges */}
          <motion.span
            className="lp-hero__float"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            🏆
          </motion.span>
          <motion.span
            className="lp-hero__float lp-hero__float--2"
            animate={{ y: [0, 7, 0] }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 0.6,
            }}
          >
            ⚡
          </motion.span>
          <motion.span
            className="lp-hero__float lp-hero__float--3"
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 3.6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1.1,
            }}
          >
            🚀
          </motion.span>

          <div className="lp-hero__ring-card">
            <ProgressRing
              value={overallProgress}
              size={116}
              stroke={9}
              label="Journey"
              sublabel={`${weeksLeft} wks left`}
              id="lpHeroRing"
            />
          </div>

          <motion.div
            className="lp-hero__milestone-card"
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <span className="lp-hero__milestone-emoji">🎯</span>
            <div>
              <strong>
                {currentMilestone ? currentMilestone.title : "Java Basics"}
              </strong>
              <span>{hasRoadmap ? "Current milestone" : "Suggested start"}</span>
            </div>
          </motion.div>
        </div>
      }
    >
      <div className="lp-hero__chips">
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
          <strong>{certifications.length}</strong> cert
          {certifications.length === 1 ? "" : "s"}
        </span>
        <span className="lp-hero__chip">
          <Icon name="signal_cellular_alt" />
          <strong>{skillLevel}</strong> level
        </span>
      </div>
    </HeroSection>
  );
}
