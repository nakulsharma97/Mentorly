import { motion } from "framer-motion";

/**
 * StatsCard — one of the six summary cards on the Reports dashboard.
 * `tone` drives the icon tile + hover accent (slate/blue/amber/green/rose/violet).
 */
export default function StatsCard({ icon: Icon, label, value, subtitle, tone = "slate", index = 0 }) {
  return (
    <motion.div
      className={`rpt-stat rpt-stat--${tone}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="rpt-stat__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="rpt-stat__body">
        <p className="rpt-stat__label">{label}</p>
        <p className="rpt-stat__value">{value}</p>
        <p className="rpt-stat__sub">{subtitle}</p>
      </div>
    </motion.div>
  );
}
