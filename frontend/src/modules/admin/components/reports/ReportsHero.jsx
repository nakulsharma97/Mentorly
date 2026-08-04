import { motion } from "framer-motion";
import { ArrowRight, FileWarning, ShieldCheck, Sparkles } from "lucide-react";

/**
 * ReportsHero — Trust & Safety gradient banner. Contains a CTA that scrolls
 * to the reports queue and a decorative shield illustration with a floating
 * report card + particles.
 */
export default function ReportsHero({ openCount = 0, onReview }) {
  return (
    <motion.section
      className="rpt-hero"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Trust and Safety overview"
    >
      <div>
        <p className="rpt-hero__label">
          <ShieldCheck size={15} aria-hidden="true" />
          Trust &amp; Safety
        </p>
        <h2 className="rpt-hero__title">Trust &amp; Safety</h2>
        <p className="rpt-hero__desc">
          Keep SkillSwap safe for every learner and mentor. Review reports, investigate
          incidents, and take action — all from one queue.
        </p>
        <div className="rpt-hero__actions">
          <button type="button" className="rpt-hero__cta" onClick={onReview}>
            Review reports queue
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          {openCount > 0 && (
            <div className="rpt-hero__stat">
              <strong>{openCount}</strong>
              <span>Open now</span>
            </div>
          )}
        </div>
      </div>

      <div className="rpt-hero__art" aria-hidden="true">
        <span className="rpt-hero__shield">
          <ShieldCheck size={58} strokeWidth={1.4} />
        </span>
        <span className="rpt-hero__card">
          <FileWarning size={18} />
          <span>
            Report #104
            <small>Resolved · 12 min ago</small>
          </span>
        </span>
        <span className="rpt-hero__pill">
          <Sparkles size={14} />
          98% resolved in 48h
        </span>
        <span className="rpt-hero__particle" />
        <span className="rpt-hero__particle" />
        <span className="rpt-hero__particle" />
        <span className="rpt-hero__particle" />
        <span className="rpt-hero__particle" />
        <span className="rpt-hero__particle" />
      </div>
    </motion.section>
  );
}
