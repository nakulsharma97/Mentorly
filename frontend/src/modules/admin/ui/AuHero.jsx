import { motion } from "framer-motion";

/**
 * AuHero — premium gradient banner shared by every admin page. `variant`
 * picks the gradient + illustration icon (dashboard/users/payments/skills/
 * sessions/wallet/settings/analytics). `cta` renders the white pill button,
 * `stat` an optional right-side stat chip.
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
    <motion.section
      className={`au-hero au-hero--${variant}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      aria-label={`${title} overview`}
    >
      <div>
        {label && (
          <p className="au-hero__label">
            {label}
          </p>
        )}
        <h2 className="au-hero__title">{title}</h2>
        {description && <p className="au-hero__desc">{description}</p>}
        {(cta || stat) && (
          <div className="au-hero__actions">
            {cta}
            {stat}
          </div>
        )}
      </div>

      <div className="au-hero__art" aria-hidden="true">
        {Icon && (
          <span className="au-hero__icon">
            <Icon size={58} strokeWidth={1.4} />
          </span>
        )}
        <span className="au-hero__particle" />
        <span className="au-hero__particle" />
        <span className="au-hero__particle" />
        <span className="au-hero__particle" />
        <span className="au-hero__particle" />
        <span className="au-hero__particle" />
      </div>
    </motion.section>
  );
}
