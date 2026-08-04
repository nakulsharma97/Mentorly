import { motion } from "framer-motion";
import { GraduationCap, Handshake, Search } from "lucide-react";
import LqrButton from "./LqrButton";

/**
 * RequestsEmptyState — beautiful illustration + CTA shown when there are no
 * requests (or nothing matches the current search/filter).
 */
export default function RequestsEmptyState({
  title = "No Requests Yet",
  description = "Find mentors and start learning. Your session requests will appear here.",
  ctaLabel = "Find Mentors",
  ctaTo = "/learner/mentors",
  filtered = false,
}) {
  return (
    <motion.div
      className="lqr-empty"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="lqr-empty__art" aria-hidden="true">
        <span className="lqr-empty__blob lqr-empty__blob--back" />
        <span className="lqr-empty__blob" />
        <span className="lqr-empty__icon">
          {filtered ? <Search size={54} strokeWidth={1.5} /> : <Handshake size={54} strokeWidth={1.5} />}
        </span>
        <span className="lqr-empty__chip lqr-empty__chip--a">
          <GraduationCap size={20} />
        </span>
        <span className="lqr-empty__chip lqr-empty__chip--b">
          <Handshake size={18} />
        </span>
        <span className="lqr-empty__chip lqr-empty__chip--c">
          <Search size={18} />
        </span>
      </div>
      <h2 className="lqr-empty__title">{title}</h2>
      <p className="lqr-empty__desc">{description}</p>
      {!filtered && (
        <div className="lqr-empty__action">
          <LqrButton variant="primary" icon={Search} to={ctaTo}>
            {ctaLabel}
          </LqrButton>
        </div>
      )}
    </motion.div>
  );
}
