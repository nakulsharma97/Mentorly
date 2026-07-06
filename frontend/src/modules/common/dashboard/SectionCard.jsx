import { Link } from "react-router-dom";
import Icon from "./Icon";

/** Reusable titled card used by every dashboard section. */
export default function SectionCard({
  title,
  icon,
  action,
  actionTo,
  onAction,
  headerExtra,
  className = "",
  children,
}) {
  return (
    <section className={`md-card ${className}`.trim()}>
      {(title || action || headerExtra) && (
        <div className="md-section__head">
          {title && (
            <h3 className="md-section__title">
              {icon && <Icon name={icon} />}
              {title}
            </h3>
          )}
          {headerExtra}
          {action &&
            (actionTo ? (
              <Link to={actionTo} className="md-section__link">
                {action} <Icon name="arrow_forward" />
              </Link>
            ) : (
              <button
                type="button"
                className="md-section__link"
                onClick={onAction}
              >
                {action} <Icon name="arrow_forward" />
              </button>
            ))}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionTo,
  onAction,
}) {
  return (
    <div className="md-empty">
      <div className="md-empty__icon">
        <Icon name={icon} />
      </div>
      <p className="md-empty__title">{title}</p>
      {description && <p className="md-empty__desc">{description}</p>}
      {actionLabel &&
        (actionTo ? (
          <Link
            to={actionTo}
            className="md-btn md-btn--outline md-btn--sm"
            style={{ marginTop: 6 }}
          >
            {actionLabel}
          </Link>
        ) : (
          <button
            type="button"
            className="md-btn md-btn--outline md-btn--sm"
            style={{ marginTop: 6 }}
            onClick={onAction}
          >
            {actionLabel}
          </button>
        ))}
    </div>
  );
}
