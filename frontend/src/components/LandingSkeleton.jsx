/**
 * Lightweight skeleton shown while lazy-loaded landing sections are loading.
 * Uses pure CSS animations (no JS runtime cost) and matches the landing
 * page layout rhythm so content does not "jump" when the real chunk arrives.
 */
export default function LandingSkeleton({ variant = 'default' }) {
  const shimmer = {
    background: 'linear-gradient(90deg, var(--lp-card, rgba(255,255,255,0.6)) 25%, rgba(255,255,255,0.9) 50%, var(--lp-card, rgba(255,255,255,0.6)) 75%)',
    backgroundSize: '200% 100%',
    animation: 'landing-shimmer 1.5s ease-in-out infinite',
    borderRadius: 8,
  };

  const bar = (w, h = 12) => (
    <div style={{ ...shimmer, width: w, height: h, marginBottom: 8 }} />
  );

  const card = (h = 120) => (
    <div style={{ ...shimmer, height: h, borderRadius: 16, flex: '1 1 200px', minWidth: 200 }} />
  );

  if (variant === 'features') {
    return (
      <section className="landing-section" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <style>{`@keyframes landing-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {bar('120px', 10)}
          {bar('340px', 22)}
          {bar('280px', 12)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4].map(i => <div key={i}>{card(140)}</div>)}
        </div>
      </section>
    );
  }

  if (variant === 'mentors') {
    return (
      <section className="landing-section" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <style>{`@keyframes landing-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {bar('100px', 10)}
          {bar('260px', 22)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i}>{card(200)}</div>)}
        </div>
      </section>
    );
  }

  if (variant === 'workflow') {
    return (
      <section className="landing-section" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <style>{`@keyframes landing-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          {bar('80px', 10)}
          {bar('300px', 22)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20 }}>
          {[1, 2, 3].map(i => <div key={i}>{card(160)}</div>)}
        </div>
      </section>
    );
  }

  // Default skeleton — generic section placeholder
  return (
    <section className="landing-section" style={{ padding: '60px 24px', maxWidth: 1100, margin: '0 auto' }}>
      <style>{`@keyframes landing-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        {bar('100px', 10)}
        {bar('320px', 20)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[1, 2, 3].map(i => <div key={i}>{card(120)}</div>)}
      </div>
    </section>
  );
}
