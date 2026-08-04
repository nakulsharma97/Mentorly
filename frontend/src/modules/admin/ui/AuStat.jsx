import { motion } from "framer-motion";

/**
 * AuStat — one summary stat card. `tone` drives the icon tile + hover accent
 * (slate/blue/amber/green/rose/violet/red). `index` staggers the fade-up.
 */
export default function AuStat({ icon: Icon, label, value, subtitle, tone = "slate", index = 0 }) {
  return (
    <motion.div
      className={`au-stat au-stat--${tone}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="au-stat__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="au-stat__body">
        <p className="au-stat__label">{label}</p>
        <p className="au-stat__value">{value}</p>
        <p className="au-stat__sub">{subtitle}</p>
      </div>
    </motion.div>
  );
}
