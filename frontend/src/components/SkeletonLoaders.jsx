import './SkeletonLoaders.css';

export function SkeletonLine({ width = '100%', height = '16px', className = '' }) {
  return (
    <div
      className={`skeleton-line ${className}`}
      style={{ width, height }}
      role="status"
      aria-label="Loading..."
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div className={`skeleton-card ${className}`} role="status" aria-label="Loading card...">
      <SkeletonLine height="120px" width="100%" />
      <div className="skeleton-card-content">
        <SkeletonLine height="20px" width="80%" />
        <SkeletonLine height="16px" width="100%" />
        <SkeletonLine height="16px" width="70%" />
      </div>
    </div>
  );
}

export function SkeletonMentorCard({ className = '' }) {
  return (
    <div className={`skeleton-mentor-card ${className}`} role="status" aria-label="Loading mentor...">
      <div className="skeleton-avatar">
        <SkeletonLine height="80px" width="80px" />
      </div>
      <SkeletonLine height="20px" width="70%" />
      <SkeletonLine height="16px" width="100%" />
      <SkeletonLine height="16px" width="60%" />
      <SkeletonLine height="40px" width="100%" />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="skeleton-dashboard" role="status" aria-label="Loading dashboard...">
      <SkeletonLine height="32px" width="40%" />
      <SkeletonLine height="16px" width="60%" className="mt-2" />
      
      <div className="skeleton-grid mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-metric-card">
            <SkeletonLine height="14px" width="60%" />
            <SkeletonLine height="28px" width="40%" className="mt-2" />
          </div>
        ))}
      </div>

      <div className="skeleton-section mt-8">
        <SkeletonLine height="24px" width="30%" />
        <div className="skeleton-list mt-4">
          {[1, 2, 3].map(i => (
            <SkeletonCard key={i} className="mb-4" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonSessionList({ rows = 4 }) {
  return (
    <div className="skeleton-session-list" role="status" aria-label="Loading sessions...">
      {[...Array(rows)].map((_, index) => (
        <div key={index} className="skeleton-session-item">
          <div className="skeleton-session-copy">
            <SkeletonLine height="18px" width="45%" />
            <SkeletonLine height="14px" width="70%" className="mt-2" />
            <SkeletonLine height="14px" width="55%" className="mt-2" />
          </div>
          <SkeletonLine height="36px" width="120px" className="skeleton-session-action" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonMentorGrid({ cards = 3 }) {
  return (
    <div className="skeleton-mentor-grid" role="status" aria-label="Loading mentors...">
      {[...Array(cards)].map((_, index) => (
        <SkeletonMentorCard key={index} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div className="skeleton-table" role="status" aria-label="Loading table...">
      {[...Array(rows)].map((_, rowIdx) => (
        <div key={rowIdx} className="skeleton-row">
          {[...Array(columns)].map((_, colIdx) => (
            <SkeletonLine
              key={colIdx}
              height="16px"
              width={Math.random() > 0.5 ? '80%' : '100%'}
              className="skeleton-cell"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonProfileSetup() {
  return (
    <div className="skeleton-profile" role="status" aria-label="Loading profile...">
      <div className="skeleton-header">
        <SkeletonLine height="40px" width="200px" />
        <SkeletonLine height="16px" width="300px" className="mt-2" />
      </div>

      <div className="skeleton-form mt-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-form-group mb-4">
            <SkeletonLine height="14px" width="100px" />
            <SkeletonLine height="40px" width="100%" className="mt-2" />
          </div>
        ))}
      </div>

      <div className="skeleton-actions mt-6">
        <SkeletonLine height="40px" width="120px" />
        <SkeletonLine height="40px" width="120px" />
      </div>
    </div>
  );
}
