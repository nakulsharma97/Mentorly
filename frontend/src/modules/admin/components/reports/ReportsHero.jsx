import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import HeroSection from "../../../../components/HeroSection";

/**
 * ReportsHero — Trust & Safety hero banner. Delegates to the unified
 * <HeroSection /> so the Reports page renders the exact same gradient, radius,
 * height, spacing and buttons as every other page hero. The CTA scrolls to the
 * reports queue; the open count and trust metrics render as floating glass
 * cards in the fixed 260×260 art box.
 */
export default function ReportsHero({ openCount = 0, onReview }) {
  return (
    <HeroSection
      badge={
        <>
          <ShieldCheck size={15} aria-hidden="true" />
          Trust &amp; Safety
        </>
      }
      title="Trust & Safety"
      subtitle="Keep SkillSwap safe for every learner and mentor. Review reports, investigate incidents, and take action — all from one queue."
      primaryButton={
        <button
          type="button"
          className="hero-section__btn hero-section__btn--primary"
          onClick={onReview}
        >
          Review reports queue
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      }
      floatingCards={
        <>
          {openCount > 0 && (
            <div className="hero-section__glass hero-section__glass--stat">
              <div className="hero-section__glass-num">{openCount}</div>
              <div className="hero-section__glass-label">Open now</div>
            </div>
          )}
          <div className="hero-section__glass hero-section__glass--main">
            <div className="hero-section__glass-head">
              <span className="hero-section__glass-icon">
                <ShieldCheck size={22} aria-hidden="true" />
              </span>
              <div>
                <div className="hero-section__glass-title">Trust &amp; Safety</div>
                <div className="hero-section__glass-sub">Moderation queue</div>
              </div>
            </div>
          </div>
          <div className="hero-section__glass hero-section__glass--chart">
            <div className="hero-section__glass-head" style={{ gap: 6 }}>
              <Sparkles size={14} aria-hidden="true" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                98% resolved in 48h
              </span>
            </div>
          </div>
        </>
      }
    />
  );
}
