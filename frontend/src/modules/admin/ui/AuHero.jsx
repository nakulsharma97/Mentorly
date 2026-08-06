import HeroSection from "../../../components/HeroSection";

/**
 * AuHero — premium hero shared by admin pages. Delegates to the unified
 * <HeroSection /> so every page (dashboard, users, payments, skills,
 * sessions, wallet, settings, analytics) renders the exact same gradient /
 * radius / buttons as the rest of the product. `variant` is kept for API
 * compatibility (gradients are now unified). `cta` renders the white pill
 * button, `stat` an optional right-side stat chip.
 */
export default function AuHero({
  variant = "dashboard",
  label,
  title,
  description,
  icon: Icon,
  cta,
  stat,
}) {
  return (
    <HeroSection
      className={`au-hero--${variant}`}
      badge={label}
      title={title}
      subtitle={description}
      ariaLabel={`${title} overview`}
      primaryButton={cta}
      secondaryButton={stat}
      illustration={
        Icon ? (
          <div className="au-hero__art au-hero__art--shared" aria-hidden="true">
            <span className="au-hero__icon au-hero__icon--shared">
              <Icon size={58} strokeWidth={1.4} />
            </span>
            <span className="au-hero__particle" />
            <span className="au-hero__particle" />
            <span className="au-hero__particle" />
          </div>
        ) : undefined
      }
    />
  );
}
