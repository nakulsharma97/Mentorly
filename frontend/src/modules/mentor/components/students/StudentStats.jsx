import { motion } from "framer-motion";

const CARD = [
  { icon: "groups", tone: "teal", label: "Total Students", key: "total", desc: "Unique learners" },
  { icon: "bolt", tone: "blue", label: "Active Students", key: "active", desc: "With upcoming sessions" },
  { icon: "task_alt", tone: "green", label: "Completed Sessions", key: "completed", desc: "Across all learners" },
  { icon: "star", tone: "orange", label: "Average Rating", key: "rating", desc: "From learner reviews" },
];

/**
 * Four KPI cards — icon tile top-left, bold 42px metric, muted description.
 * Slides up on mount with a stagger and lifts on hover.
 */
export default function StudentStats({ total = 0, active = 0, completed = 0, avgRating = 0 }) {
  const values = {
    total,
    active,
    completed,
    rating: typeof avgRating === "number" && avgRating > 0 ? avgRating.toFixed(1) : "—",
  };

  return (
    <div className="ss-stats" role="group" aria-label="Student statistics">
      {CARD.map((c, i) => (
        <motion.div
          key={c.key}
          className="ss-stat"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.08 * i, ease: "easeOut" }}
        >
          <span className={`ss-stat__icon ss-stat__icon--${c.tone}`}>
            <span className="material-symbols-outlined">{c.icon}</span>
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="ss-stat__value">{values[c.key]}</div>
            <div className="ss-stat__label">{c.label}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
