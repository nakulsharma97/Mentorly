import { motion } from "framer-motion";

/**
 * RequestStatCard — one of the four summary cards (total / pending /
 * accepted / declined). Uses a per-tone soft gradient and hover lift.
 */
export default function RequestStatCard({ icon: Icon, label, value, description, tone = "total", index = 0 }) {
  return (
    <motion.div
      className={`lqr-stat lqr-stat--${tone}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="lqr-stat__icon" aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="lqr-stat__body">
        <p className="lqr-stat__value">{value}</p>
        <p className="lqr-stat__label">{label}</p>
        <p className="lqr-stat__desc">{description}</p>
      </div>
    </motion.div>
  );
}
