export default function DashboardMetricCard({ label, value, tone = 'primary', icon, trend, extraClassName = '' }) {
  const iconMap = {
    primary:   'trending_up',
    success:   'check_circle',
    warning:   'star',
    secondary: 'group',
    neutral:   'info',
  };

  const trendNum = trend != null ? Number(trend) : null;
  const trendClass = trendNum == null ? '' : trendNum > 0 ? 'up' : trendNum < 0 ? 'down' : 'flat';
  const trendIcon  = trendNum == null ? '' : trendNum > 0 ? 'arrow_upward' : trendNum < 0 ? 'arrow_downward' : 'remove';

  const displayIcon = icon || iconMap[tone] || iconMap.primary;

  return (
    <div
      className={`dash-metric-card ${extraClassName}`.trim()}
      data-tone={tone}
    >
      <div className="dash-metric-icon" data-tone={tone} aria-hidden="true">
        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
          {displayIcon}
        </span>
      </div>
      <p className="dash-metric-label">{label}</p>
      <p className="dash-metric-value">{value}</p>
      {trendNum != null && (
        <span className={`dash-metric-trend ${trendClass}`}>
          <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>{trendIcon}</span>
          {Math.abs(trendNum)}%
        </span>
      )}
    </div>
  );
}
