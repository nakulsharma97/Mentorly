import { Link } from 'react-router-dom';

export default function NotFoundPage({ isLoggedIn = false }) {
  return (
    <main>
      <section className="dashboard-card">
        <p className="muted">404</p>
        <h2>Page not found</h2>
        <p className="muted">The page you are looking for does not exist or was removed during cleanup.</p>
        <div style={{ marginTop: '16px' }}>
          <Link className="auth-nav-btn" to={isLoggedIn ? '/home' : '/'}>
            Go back to {isLoggedIn ? 'dashboard' : 'home'}
          </Link>
        </div>
      </section>
    </main>
  );
}
