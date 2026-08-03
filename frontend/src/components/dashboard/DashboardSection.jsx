import { Link } from 'react-router';

export default function DashboardSection({
  title,
  icon,
  children,
  iconTone = 'primary',
  viewAll,
  viewAllTo,
  viewAllOnClick,
}) {
  const toneColor = {
    primary:   '#0f766e',
    success:   '#16a34a',
    warning:   '#d97706',
    secondary: '#7c3aed',
    neutral:   '#64748b',
  };

  return (
    <section className="dash-section">
      <div className="dash-section-header">
        <h2 className="dash-section-title">
          {icon && (
            <span
              className="material-symbols-outlined"
              style={{ color: toneColor[iconTone] || toneColor.primary }}
            >
              {icon}
            </span>
          )}
          {title}
        </h2>
        {viewAll && (
          viewAllTo ? (
            <Link to={viewAllTo} className="dash-section-viewall">
              {viewAll}
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>chevron_right</span>
            </Link>
          ) : (
            <button type="button" className="dash-section-viewall" onClick={viewAllOnClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              {viewAll}
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>chevron_right</span>
            </button>
          )
        )}
      </div>
      <div className="dash-section-body">{children}</div>
    </section>
  );
}
