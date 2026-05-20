import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import DashboardMetricCard from '../components/dashboard/DashboardMetricCard';
import DashboardSection from '../components/dashboard/DashboardSection';
import EmptyStateCard from '../components/dashboard/EmptyStateCard';
import { getBookingStatusMeta, getRoadmapMilestoneCount } from '../utils/dashboard';
import { SkeletonDashboard } from '../components/SkeletonLoaders';
import './dashboard.css';

export default function LearnerDashboard({ profile }) {
  const navigate = useNavigate();
  const firstName = String(profile?.fullName || 'Learner').trim().split(' ')[0] || 'Learner';
  const [loading, setLoading] = useState(true);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [roadmaps, setRoadmaps] = useState([]);
  const [watchedSkills, setWatchedSkills] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [progressMetrics, setProgressMetrics] = useState({
    completedThisMonth: 0,
    roadmapCompletion: 0,
    skillBreadth: 0,
    learningConsistency: 0,
  });
  const [stats, setStats] = useState({
    totalBookings: 0,
    completedSessions: 0,
    learningHours: 0,
    skillsLearning: 0,
  });

  useEffect(() => { loadLearnerData(); }, []);

  const loadLearnerData = async () => {
    try {
      setLoading(true);
      await client.post('/api/v1/certifications/evaluate').catch(() => null);
      const [bookingsRes, roadmapsRes, watchlistRes, certificationsRes] = await Promise.all([
        client.get('/api/v1/bookings'),
        client.get('/api/v1/roadmaps'),
        client.get('/api/v1/watchlist'),
        client.get('/api/v1/certifications/me').catch(() => ({ data: { data: [] } })),
      ]);

      const allBookings = bookingsRes.data.data || [];
      const upcoming = allBookings.filter((b) => {
        const start = b?.session?.startTime;
        return start && new Date(start) > new Date();
      });
      const sortedUpcoming = [...upcoming].sort(
        (a, b) => new Date(a?.session?.startTime || 0).getTime() - new Date(b?.session?.startTime || 0).getTime()
      );
      setUpcomingSessions(sortedUpcoming);
      setRoadmaps(roadmapsRes.data.data || []);
      setWatchedSkills(watchlistRes.data.data || []);
      setCertifications(certificationsRes.data.data || []);

      const completedBookings = allBookings.filter((b) => (b.bookingStatus || b.status) === 'COMPLETED');
      const completed = completedBookings.length;
      const learningHours = allBookings.length * 1.5;
      const now = new Date();
      const completedThisMonth = completedBookings.filter((b) => {
        const start = b?.session?.startTime;
        if (!start) return false;
        const date = new Date(start);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      }).length;

      const roadmapCompletion = roadmapsRes.data.data?.length
        ? Math.round(roadmapsRes.data.data.reduce((sum, item) => sum + Number(item.progressPercent || 0), 0) / roadmapsRes.data.data.length)
        : 0;

      const uniqueSkills = new Set(completedBookings.map((b) => b?.session?.skill?.name).filter(Boolean));
      const activeDays = new Set(
        completedBookings.map((b) => {
          const d = b?.session?.startTime ? new Date(b.session.startTime) : null;
          return d ? d.toISOString().slice(0, 10) : null;
        }).filter(Boolean)
      );

      setProgressMetrics({
        completedThisMonth,
        roadmapCompletion,
        skillBreadth: uniqueSkills.size,
        learningConsistency: Math.min(100, activeDays.size * 10),
      });
      setStats({
        totalBookings: allBookings.length,
        completedSessions: completed,
        learningHours: Math.round(learningHours * 10) / 10,
        skillsLearning: watchlistRes.data.data?.length || 0,
      });
      setLoading(false);
    } catch (error) {
      console.error('Error loading learner data:', error);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>
        <SkeletonDashboard />
      </main>
    );
  }

  const nextSession = upcomingSessions[0] || null;
  const hasProfileBasics = Boolean(String(profile?.aboutMe || '').trim() && String(profile?.skills || '').trim());
  const hasBooking = stats.totalBookings > 0;
  const hasMessageTrigger = hasBooking;

  const onboardingSteps = [
    { id: 'profile', title: 'Complete your profile', description: 'Add bio and skills so mentors can personalize guidance.', done: hasProfileBasics, route: '/profile-setup', cta: 'Update profile' },
    { id: 'watchlist', title: 'Add 3 watched skills', description: 'Improve mentor matching and recommendation quality.', done: watchedSkills.length >= 3, route: '/home', cta: 'Open watchlist' },
    { id: 'browse', title: 'Browse mentors', description: 'Find mentors aligned to your goals and learning stage.', done: stats.totalBookings > 0, route: '/mentors', cta: 'Browse mentors' },
    { id: 'book', title: 'Book first session', description: 'Lock your first mentorship slot to begin active learning.', done: hasBooking, route: '/mentors', cta: 'Book a session' },
    { id: 'message', title: 'Message your mentor', description: 'Share goals and prep notes before your session starts.', done: hasMessageTrigger, route: '/messages', cta: 'Open messages' },
  ];
  const completedOnboarding = onboardingSteps.filter((s) => s.done).length;
  const onboardingPercent = Math.round((completedOnboarding / onboardingSteps.length) * 100);

  let nextStepPanel = { title: 'Build your learning setup', text: 'Complete your profile and add watched skills to unlock better mentor matching.', route: '/profile-setup', cta: 'Complete setup' };
  if (stats.totalBookings === 0) {
    nextStepPanel = { title: 'Book your first mentor session', text: 'You are one booking away from converting your learning plan into real outcomes.', route: '/mentors', cta: 'Find a mentor now' };
  } else if (nextSession) {
    nextStepPanel = { title: 'Prepare for your upcoming session', text: 'Review mentor profile, note 3 questions, and send your goals in chat before session start.', route: '/messages', cta: 'Prepare in messages' };
  } else if (stats.completedSessions > 0) {
    nextStepPanel = { title: 'Continue your momentum', text: 'You completed sessions already. Book your next slot while context is still fresh.', route: '/mentors', cta: 'Book next session' };
  }

  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 20px' }}>

      {/* ── Hero Banner ── */}
      <div className="dash-hero dash-hero-learner">
        <div className="dash-hero-orb" style={{ width: 300, height: 300, top: -100, right: -60, background: 'rgba(56,189,248,0.18)' }} />
        <div className="dash-hero-orb" style={{ width: 240, height: 240, bottom: -90, left: -50, background: 'rgba(52,211,153,0.15)' }} />
        <div className="dash-hero-inner">
          <div>
            <p className="dash-hero-eyebrow">Learner Space</p>
            <h1 className="dash-hero-title">Welcome back, {firstName} 🚀</h1>
            <p className="dash-hero-sub">
              Your workspace is organized for momentum — track progress, join upcoming sessions, and discover mentors faster.
            </p>
            <div className="dash-hero-actions">
              <Link to="/mentors" className="dash-hero-btn-primary">Browse All Mentors</Link>
              <Link to="/sessions" className="dash-hero-btn-ghost">Learning Path</Link>
              <Link to="/messages" className="dash-hero-btn-ghost">Messages</Link>
            </div>
          </div>
          <div className="dash-hero-stats">
            <div className="dash-hero-stat">
              <p className="dash-hero-stat-label">Next Session</p>
              <p className="dash-hero-stat-value" style={{ fontSize: '0.95rem', fontWeight: 700 }}>
                {nextSession ? (nextSession.session?.skill?.name || 'Mentor session') : 'No session booked'}
              </p>
              <p className="dash-hero-stat-desc">
                {nextSession ? new Date(nextSession.session?.startTime).toLocaleString() : 'Find a mentor to start'}
              </p>
            </div>
            <div className="dash-hero-stat">
              <p className="dash-hero-stat-label">Roadmap Progress</p>
              <p className="dash-hero-stat-value">{progressMetrics.roadmapCompletion}%</p>
              <p className="dash-hero-stat-desc">Average across active paths</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="dash-metric-grid">
        <DashboardMetricCard label="Total Bookings" value={stats.totalBookings} tone="primary" icon="bookmark_added" />
        <DashboardMetricCard label="Completed" value={stats.completedSessions} tone="success" icon="task_alt" />
        <DashboardMetricCard label="Learning Hours" value={stats.learningHours} tone="secondary" icon="schedule" />
        <DashboardMetricCard label="Skills Watching" value={stats.skillsLearning} tone="neutral" icon="visibility" />
      </div>

      {/* ── Onboarding Checklist ── */}
      <DashboardSection title="Learner Onboarding Checklist" icon="checklist" iconTone="primary">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--muted,#334155)', fontWeight: 600 }}>
            {completedOnboarding} of {onboardingSteps.length} completed
          </p>
          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0f766e' }}>{onboardingPercent}%</span>
        </div>
        <div className="dash-onboarding-progress-bar-wrap">
          <div className="dash-onboarding-progress-fill" style={{ width: `${onboardingPercent}%` }} />
        </div>
        <div className="dash-onboarding-grid">
          {onboardingSteps.map((step, idx) => (
            <div key={step.id} className={`dash-onboarding-step${step.done ? ' is-done' : ''}`}>
              <div className="dash-onboarding-step-header">
                <p className="dash-onboarding-step-title">{step.title}</p>
                <span className="dash-onboarding-step-num">
                  {step.done
                    ? <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check</span>
                    : idx + 1}
                </span>
              </div>
              <p className="dash-onboarding-step-desc">{step.description}</p>
              {!step.done && (
                <Link to={step.route} className="dash-onboarding-step-cta">{step.cta} →</Link>
              )}
            </div>
          ))}
        </div>
      </DashboardSection>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gap: '20px', marginTop: '20px' }}>

        {/* Smart Next Step */}
        <div style={{
          borderRadius: '16px',
          border: '1px solid rgba(15,118,110,0.2)',
          background: 'rgba(15,118,110,0.05)',
          padding: '20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ color: '#0f766e' }}>assistant</span>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: 'var(--text,#182028)' }}>What Should I Do Now?</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text,#182028)' }}>{nextStepPanel.title}</h3>
              <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--muted,#334155)', lineHeight: 1.55 }}>{nextStepPanel.text}</p>
            </div>
            <Link to={nextStepPanel.route} style={{
              display: 'inline-flex',
              alignSelf: 'flex-start',
              padding: '10px 20px',
              borderRadius: '10px',
              background: '#0f766e',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.85rem',
              textDecoration: 'none',
            }}>
              {nextStepPanel.cta}
            </Link>
          </div>
        </div>

        {/* Sessions + Roadmaps side by side */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>

          {/* Upcoming Sessions */}
          <DashboardSection title="Upcoming Sessions" icon="calendar_today" iconTone="primary" viewAll="All sessions" viewAllTo="/sessions">
            {upcomingSessions.length === 0 ? (
              <EmptyStateCard
                icon="calendar_today"
                title="No upcoming sessions yet"
                description="Book your next session to keep your momentum and weekly learning streak."
                actionLabel="Find mentors"
                actionTo="/mentors"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {upcomingSessions.slice(0, 3).map((booking) => {
                  const statusMeta = getBookingStatusMeta(booking);
                  return (
                    <div
                      key={booking.id}
                      className="dash-session-card"
                      onClick={() => navigate('/messages')}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === 'Enter' && navigate('/messages')}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <div>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text,#182028)' }}>
                            {booking.session?.mentor?.fullName}
                          </p>
                          <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--muted,#334155)' }}>
                            {booking.session?.skill?.name}
                          </p>
                        </div>
                        <span className={`dash-status-chip dash-status-${(booking.bookingStatus || booking.status || '').toLowerCase()}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--muted,#334155)', marginBottom: '6px' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>schedule</span>
                        {new Date(booking.session?.startTime).toLocaleString()}
                      </div>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--muted,#334155)' }}>
                        Next: {statusMeta.action}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </DashboardSection>

          {/* Learning Roadmaps */}
          <DashboardSection title="My Learning Paths" icon="route" iconTone="secondary" viewAll="All paths" viewAllTo="/sessions">
            {roadmaps.length === 0 ? (
              <EmptyStateCard
                icon="route"
                title="No active learning paths yet"
                description="Roadmaps are generated after you complete a booking with a mentor."
                actionLabel="Book to create roadmap"
                actionTo="/mentors"
                tone="secondary"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {roadmaps.slice(0, 2).map((roadmap) => (
                  <div
                    key={roadmap.id}
                    className="dash-session-card"
                    onClick={() => navigate(`/sessions/${roadmap.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/sessions/${roadmap.id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem', color: 'var(--text,#182028)' }}>{roadmap.title}</p>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: '#7c3aed' }}>{roadmap.progressPercent || 0}%</span>
                    </div>
                    <div className="dash-progress-track" style={{ marginBottom: '8px' }}>
                      <div className="dash-progress-fill" style={{ width: `${roadmap.progressPercent || 0}%`, background: 'linear-gradient(90deg, #7c3aed, #a78bfa)' }} />
                    </div>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--muted,#334155)' }}>
                      With {roadmap.mentorName} · {getRoadmapMilestoneCount(roadmap)} milestones
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>
        </div>

        {/* Progress Metrics + Sidebar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>

          {/* Progress Metrics */}
          <DashboardSection title="Progress Metrics" icon="trending_up" iconTone="secondary">
            <div className="dash-analytics-grid">
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Completed This Month</p>
                <p className="dash-analytic-value">{progressMetrics.completedThisMonth}</p>
              </div>
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Roadmap Completion</p>
                <p className="dash-analytic-value">{progressMetrics.roadmapCompletion}%</p>
              </div>
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Skill Breadth</p>
                <p className="dash-analytic-value">{progressMetrics.skillBreadth}</p>
              </div>
              <div className="dash-analytic-tile">
                <p className="dash-analytic-label">Learning Consistency</p>
                <p className="dash-analytic-value">{progressMetrics.learningConsistency}%</p>
              </div>
            </div>
          </DashboardSection>

          {/* Watched Skills */}
          <DashboardSection title="Watched Skills" icon="bookmark" iconTone="secondary">
            {watchedSkills.length === 0 ? (
              <EmptyStateCard
                icon="bookmark"
                title="Your watchlist is empty"
                description="Add at least 3 skills to improve mentor recommendations."
                actionLabel="Browse skills"
                actionTo="/mentors"
                tone="secondary"
              />
            ) : (
              <div className="dash-skill-pills">
                {watchedSkills.slice(0, 8).map((skill) => (
                  <span key={skill.id} className="dash-skill-pill">
                    {skill.name}
                    <span className="dash-skill-pill-count">{skill.mentorCount || 0}</span>
                  </span>
                ))}
              </div>
            )}
          </DashboardSection>

          {/* Certifications */}
          <DashboardSection title="Certifications" icon="workspace_premium" iconTone="primary">
            {certifications.length === 0 ? (
              <EmptyStateCard
                icon="workspace_premium"
                title="No certifications yet"
                description="Complete mentor sessions and milestones to earn credibility badges."
                actionLabel="Browse mentors"
                actionTo="/mentors"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {certifications.slice(0, 4).map((cert) => (
                  <div key={cert.id} style={{
                    borderRadius: '10px',
                    border: '1px solid var(--card-border,#dbe4ea)',
                    padding: '10px 12px',
                    background: 'var(--hover-bg,#f8fafc)',
                  }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.84rem', color: 'var(--text,#182028)' }}>{cert.title}</p>
                    <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: 'var(--muted,#334155)' }}>{cert.description}</p>
                  </div>
                ))}
              </div>
            )}
          </DashboardSection>

          {/* Today Focus */}
          <DashboardSection title="Today's Focus" icon="check_circle" iconTone="success">
            <div className="dash-focus-grid" style={{ gridTemplateColumns: '1fr' }}>
              <div className="dash-focus-card">
                <p className="dash-focus-label">Book a Session</p>
                <p className="dash-focus-text">Explore mentor profiles and lock your next learning slot.</p>
                <Link to="/mentors" className="dash-focus-link">Browse now →</Link>
              </div>
              <div className="dash-focus-card">
                <p className="dash-focus-label">Finish a Milestone</p>
                <p className="dash-focus-text">Pick one roadmap task and complete it before your next session.</p>
                <Link to="/sessions" className="dash-focus-link">Open path →</Link>
              </div>
              <div className="dash-focus-card">
                <p className="dash-focus-label">Stay Connected</p>
                <p className="dash-focus-text">Send your latest updates to mentors for faster feedback loops.</p>
                <Link to="/messages" className="dash-focus-link">Go to messages →</Link>
              </div>
            </div>
          </DashboardSection>

          {/* Quick Actions */}
          <DashboardSection title="Quick Actions" icon="bolt" iconTone="primary">
            <div className="dash-quick-actions">
              <Link to="/mentors" className="quick-action-btn quick-action-btn-primary">Find New Mentor</Link>
              <Link to="/sessions" className="quick-action-btn quick-action-btn-outline">My Learning Paths</Link>
              <Link to="/messages" className="quick-action-btn quick-action-btn-outline">Messages</Link>
              <Link to="/wallet" className="quick-action-btn quick-action-btn-outline">Wallet &amp; Payments</Link>
            </div>
          </DashboardSection>

        </div>
      </div>
    </main>
  );
}
