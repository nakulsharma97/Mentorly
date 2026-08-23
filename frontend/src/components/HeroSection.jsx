import { motion } from "framer-motion";
import "./HeroSection.css";

/**
 * HeroSection — ONE unified hero design system for every Mentorly page.
 *
 * Every page (Students, Manage Sessions, Calendar, Analytics, Earnings,
 * Reviews, Messages, dashboards, admin, learner, mentor) renders the exact
 * same hero: same 135deg blue→teal→green gradient, same 32px radius, same
 * 40px padding, same badge/title/subtitle/buttons, same glass-card art layer.
 *
 * Only the CONTENT differs — pass different props per page.
 *
 * @param {string}   badge           small uppercase pill above the title
 * @param {string}   title           page heading (48px, white)
 * @param {string}   subtitle        supporting copy (18px, white/92)
 * @param {ReactNode} primaryButton  white pill button (right of subtitle)
 * @param {ReactNode} secondaryButton glass outline button
 * @param {ReactNode} children       extra actions rendered after the buttons
 * @param {ReactNode} illustration   art layer content (glass cards / vector)
 * @param {ReactNode} floatingCards  alias for illustration — pass the glass
 *                                   card cluster directly when no custom art
 * @param {string}   className       extra classes (compact, tall, …)
 * @param {string}   ariaLabel       a11y label for the section
 */
export default function HeroSection({
  badge,
  title,
  subtitle,
  primaryButton,
  secondaryButton,
  children,
  illustration,
  floatingCards,
  className = "",
  ariaLabel,
}) {
  return (
    <motion.section
      className={`hero-section ${className}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      aria-label={ariaLabel || title}
    >
      {/* Decorative background — blurred circles + gradient blobs, strictly
          behind content, clipped to the hero so it can never cover text. */}
      <div className="hero-section__decor" aria-hidden="true">
        <span className="hero-section__orb hero-section__orb--1" />
        <span className="hero-section__orb hero-section__orb--2" />
        <span className="hero-section__orb hero-section__orb--3" />
        <span className="hero-section__blob hero-section__blob--1" />
        <span className="hero-section__blob hero-section__blob--2" />
      </div>

      {/* Left — badge, heading, subtitle, actions (60%) */}
      <div className="hero-section__content">
        {badge && <span className="hero-section__badge">{badge}</span>}
        <h1 className="hero-section__title">{title}</h1>
        {subtitle && <p className="hero-section__subtitle">{subtitle}</p>}
        {(primaryButton || secondaryButton || children) && (
          <div className="hero-section__actions">
            {secondaryButton}
            {primaryButton}
            {children}
          </div>
        )}
      </div>

      {/* Right — art layer (35%): floating glass cards / illustration.
          Wrapped in a fixed 260×260 box so the art can NEVER change the
          hero height, regardless of page. */}
      {(illustration || floatingCards) && (
        <div className="hero-section__art" aria-hidden="true">
          <div className="hero-section__art-inner">
            {illustration || floatingCards}
          </div>
        </div>
      )}
    </motion.section>
  );
}

/** Reusable glass metric card for the hero art layer. */
export function HeroGlassCard({ className = "", children }) {
  return (
    <div className={`hero-section__glass ${className}`}>{children}</div>
  );
}
