import { motion } from "framer-motion";
import Icon from "../../../common/dashboard/Icon";
import { TrendChip } from "./ui";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

/** 8 premium stat cards with icon, number, subtitle + trend indicator. */
export default function StatsGrid({ stats }) {
  return (
    <motion.div
      className="lp-stats"
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      aria-label="Learning statistics"
    >
      {stats.map((s) => (
        <motion.article key={s.key} className="lp-stat" variants={item} whileHover={{ y: -4 }}>
          <div className="lp-stat__top">
            <span className="lp-stat__icon" style={{ background: s.bg, color: s.color }}>
              <Icon name={s.icon} />
            </span>
            <TrendChip up={s.trendUp}>{s.trend}</TrendChip>
          </div>
          <strong className="lp-stat__value">{s.value}</strong>
          <span className="lp-stat__label">{s.label}</span>
          <span className="lp-stat__spark" aria-hidden="true">
            <span style={{ width: `${Math.max(6, Math.min(100, s.spark || 0))}%` }} />
          </span>
        </motion.article>
      ))}
    </motion.div>
  );
}
