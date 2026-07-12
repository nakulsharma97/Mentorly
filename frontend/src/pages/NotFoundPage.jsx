import { Link } from 'react-router-dom';

export default function NotFoundPage({ isLoggedIn = false }) {
  return (
    <main className="lp-shell md" style={{ paddingTop: 'var(--navbar-height)' }}>
      <div className="lp-empty--premium" style={{ padding: '80px 24px' }}>
        <div className="lp-empty__icon-wrap" style={{ width: 96, height: 96, borderRadius: 32, background: 'var(--md-tint)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48 }}>
            search_off
          </span>
        </div>
        <p className="lp-empty__title" style={{ fontSize: '1.5rem' }}>Page not found</p>
        <p className="lp-empty__desc" style={{ maxWidth: '48ch', marginBottom: 8 }}>
          The page you are looking for does not exist or was removed during cleanup.
        </p>
        <div className="lp-hero__actions" style={{ justifyContent: 'center' }}>
          <Link
            to={isLoggedIn ? '/home' : '/'}
            className="md-btn md-btn--brand"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>home</span>
            {isLoggedIn ? 'Go to dashboard' : 'Go to home'}
          </Link>
          <Link
            to="/mentors"
            className="md-btn md-btn--outline"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person_search</span>
            Find Mentors
          </Link>
        </div>
      </div>
    </main>
  );
}
