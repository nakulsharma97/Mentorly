import { Link } from 'react-router-dom';

export default function EmptyStateCard({
  title,
  description,
  actionLabel,
  actionTo,
  actionOnClick,
  tone = 'primary',
  icon,
  secondaryActionLabel,
  secondaryActionTo,
  secondaryActionOnClick,
  className = ''
}) {
  const btnClass = `dash-empty-btn dash-empty-btn-${tone}`;

  return (
    <div className={`dash-empty ${className}`.trim()}>
      {icon && (
        <div className="dash-empty-icon" aria-hidden="true">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      )}
      <p className="dash-empty-title">{title}</p>
      {description && <p className="dash-empty-desc">{description}</p>}
      <div className="dash-empty-actions">
        {actionLabel && (
          actionTo ? (
            <Link to={actionTo} className={btnClass}>{actionLabel}</Link>
          ) : (
            <button type="button" className={btnClass} onClick={actionOnClick}>{actionLabel}</button>
          )
        )}
        {secondaryActionLabel && (
          secondaryActionTo ? (
            <Link to={secondaryActionTo} className="dash-empty-btn dash-empty-btn-secondary">{secondaryActionLabel}</Link>
          ) : (
            <button type="button" className="dash-empty-btn dash-empty-btn-secondary" onClick={secondaryActionOnClick}>{secondaryActionLabel}</button>
          )
        )}
      </div>
    </div>
  );
}
