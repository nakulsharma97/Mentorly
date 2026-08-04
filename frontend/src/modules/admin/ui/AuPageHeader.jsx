import { ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

/**
 * AuPageHeader — every admin page starts with the same header: breadcrumb,
 * 36px title, subtitle, and (optionally) primary action buttons on the right.
 */
export default function AuPageHeader({ crumb, title, subtitle, actions }) {
  return (
    <motion.header
      className="au-header"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        {crumb && (
          <nav className="au-header__crumb" aria-label="Breadcrumb">
            <span>{crumb[0]}</span>
            {crumb.length > 1 && <ChevronRight size={15} aria-hidden="true" />}
            <span className="au-header__crumb-current">{crumb[1]}</span>
          </nav>
        )}
        <h1 className="au-header__title">{title}</h1>
        {subtitle && <p className="au-header__sub">{subtitle}</p>}
      </div>
      {actions && <div className="au-header__actions">{actions}</div>}
    </motion.header>
  );
}
