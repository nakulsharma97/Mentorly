import { motion } from "framer-motion";

/**
 * AuEmpty — unified empty state with a decorative illustration, friendly
 * message, and an optional primary CTA.
 */
export default function AuEmpty({ icon: Icon, title, description, action }) {
  return (
    <motion.div
      className="au-empty"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="au-empty__art" aria-hidden="true">
        <span className="au-empty__blob au-empty__blob--back" />
        <span className="au-empty__blob" />
        <span className="au-empty__icon">
          {Icon && <Icon size={44} strokeWidth={1.5} />}
        </span>
      </div>
      <h3 className="au-empty__title">{title}</h3>
      {description && <p className="au-empty__desc">{description}</p>}
      {action && <div className="au-empty__action">{action}</div>}
    </motion.div>
  );
}
