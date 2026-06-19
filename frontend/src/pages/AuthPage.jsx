import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import OptimizedImage from '../components/OptimizedImage';
import './AuthPage.css';

const SECTION_IDS = ['product', 'mentors', 'workflow', 'outcomes'];

const featuredMentors = [
  {
    id: null,
    fullName: 'Maya Iyer',
    skills: 'Product Design, UX Strategy',
    averageRating: 4.9,
    totalReviews: 128,
    liveNow: true,
    profileImageUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: null,
    fullName: 'Arjun Mehta',
    skills: 'React Architecture, Frontend Systems',
    averageRating: 4.8,
    totalReviews: 94,
    liveNow: false,
    profileImageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=80',
  },
  {
    id: null,
    fullName: 'Elena Rossi',
    skills: 'Brand Strategy, Storytelling',
    averageRating: 5,
    totalReviews: 156,
    liveNow: false,
    profileImageUrl: 'https://images.unsplash.com/photo-1534751516642-a1af1ef26a56?auto=format&fit=crop&w=900&q=80',
  },
];

const getMentorInitials = (fullName) => {
  const safeName = String(fullName || '').trim();
  if (!safeName) {
    return 'M';
  }

  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

const getSkillTags = (rawSkills) => {
  const value = String(rawSkills || '').trim();
  if (!value) {
    return ['Mentorship'];
  }

  if (value.startsWith('[') && value.includes('"name"')) {
    const matches = [...value.matchAll(/"name"\s*:\s*"([^"]+)"/g)]
      .map((match) => String(match[1] || '').trim())
      .filter(Boolean);
    if (matches.length) {
      return [...new Set(matches)].slice(0, 2);
    }
  }

  return [...new Set(value.split(/[\n,;|]+/).map((part) => part.trim()).filter(Boolean))]
    .slice(0, 2);
};

const scrollToSection = (sectionId) => (event) => {
  event.preventDefault();
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

export default function AuthPage({ onSelectLogin, onSelectSignup }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('product');
  const [mentors, setMentors] = useState([]);

  useEffect(() => {
    const updateActiveSection = () => {
      const current = SECTION_IDS.findLast((sectionId) => {
        const element = document.getElementById(sectionId);
        return element && element.getBoundingClientRect().top <= 140;
      });
      if (current) {
        setActiveSection(current);
      }
    };

    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    return () => window.removeEventListener('scroll', updateActiveSection);
  }, []);

  useEffect(() => {
    const elements = document.querySelectorAll('.landing-reveal');
    if (!elements.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    client.get('/api/v1/users/mentors')
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const list = Array.isArray(response?.data?.data) ? response.data.data : [];
        setMentors(list);
      })
      .catch(() => {
        if (isMounted) {
          setMentors([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const displayMentors = useMemo(() => (mentors.length ? mentors.slice(0, 3) : featuredMentors), [mentors]);
  const mentorCountLabel = mentors.length ? `${mentors.length}+` : '50k+';

  const navLinkClass = (sectionId) => (
    activeSection === sectionId ? 'landing-nav-link is-active' : 'landing-nav-link'
  );

  const openMentor = (mentor) => {
    if (!mentor.id) {
      onSelectSignup();
      return;
    }
    navigate(`/mentors/${mentor.id}`);
  };

  return (
    <div className="landing-shell">
      <nav className="landing-nav" aria-label="Public navigation">
        <a className="landing-brand" href="#product" onClick={scrollToSection('product')}>
          <span className="landing-brand-mark">SS</span>
          <span>
            <strong>SkillSwap</strong>
            <small>Mentorship marketplace</small>
          </span>
        </a>

        <div className="landing-nav-center" aria-label="Page sections">
          <a className={navLinkClass('product')} href="#product" onClick={scrollToSection('product')}>Product</a>
          <a className={navLinkClass('mentors')} href="#mentors" onClick={scrollToSection('mentors')}>Mentors</a>
          <a className={navLinkClass('workflow')} href="#workflow" onClick={scrollToSection('workflow')}>Workflow</a>
          <a className={navLinkClass('outcomes')} href="#outcomes" onClick={scrollToSection('outcomes')}>Outcomes</a>
        </div>

        <div className="landing-nav-actions">
          <button className="landing-button landing-button-ghost" type="button" onClick={onSelectLogin}>
            Log in
          </button>
          <button className="landing-button landing-button-dark" type="button" onClick={onSelectSignup}>
            Join free
          </button>
        </div>
      </nav>

      <main>
        <section id="product" className="landing-hero">
          <div className="landing-hero-copy landing-reveal is-visible">
            <span className="landing-eyebrow">
              <span aria-hidden="true" />
              Live mentorship for practical career growth
            </span>
            <h1>Learn faster from experts who actually do the work.</h1>
            <p>
              SkillSwap connects learners with verified mentors for live sessions, structured follow-ups,
              messaging, wallet tracking, and admin-backed trust controls.
            </p>
            <div className="landing-hero-actions">
              <button className="landing-button landing-button-primary" type="button" onClick={onSelectSignup}>
                Start learning
              </button>
              <a className="landing-button landing-button-soft" href="#workflow" onClick={scrollToSection('workflow')}>
                See workflow
              </a>
            </div>
            <dl className="landing-metrics" aria-label="Platform highlights">
              <div>
                <dt>{mentorCountLabel}</dt>
                <dd>mentor profiles</dd>
              </div>
              <div>
                <dt>4.9</dt>
                <dd>avg. session rating</dd>
              </div>
              <div>
                <dt>12 min</dt>
                <dd>to book a slot</dd>
              </div>
            </dl>
          </div>

          <div className="landing-hero-visual landing-reveal is-visible">
            <div className="landing-product-card">
              <div className="landing-product-header">
                <div>
                  <span>Session room</span>
                  <strong>React architecture review</strong>
                </div>
                <span className="landing-live-pill">Live</span>
              </div>
              <OptimizedImage
                className="landing-hero-photo"
                alt="Mentor and learner reviewing a laptop in a modern workspace"
                src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=82"
                priority
              />
              <div className="landing-session-panel" aria-label="Session summary">
                <div>
                  <span className="landing-avatar-stack" aria-hidden="true">
                    <span>M</span>
                    <span>L</span>
                  </span>
                  <p>1:1 live feedback</p>
                </div>
                <strong>Booked for Friday, 6:30 PM</strong>
              </div>
            </div>
            <div className="landing-floating-note">
              <span className="material-symbols-outlined" aria-hidden="true">verified</span>
              <div>
                <strong>Verified skill graph</strong>
                <p>Mentor proof, ratings, and session outcomes in one place.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-logo-row" aria-label="Trusted categories">
          {['Design Systems', 'Full Stack', 'Finance', 'Marketing', 'Data Science'].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </section>

        <section className="landing-section landing-feature-band">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">Built for momentum</span>
            <h2>Everything feels connected, from discovery to follow-up.</h2>
            <p>Cleaner flows, better hierarchy, and practical tools for sessions that do not end when the call ends.</p>
          </div>

          <div className="landing-feature-grid">
            <article className="landing-feature-card landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">travel_explore</span>
              <h3>Browse with confidence</h3>
              <p>Readable mentor cards, clear skill tags, ratings, and availability signals help learners decide faster.</p>
            </article>
            <article className="landing-feature-card landing-feature-card-dark landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">calendar_month</span>
              <h3>Book real sessions</h3>
              <p>Create sessions, request slots, accept or decline bookings, and keep the status visible everywhere.</p>
            </article>
            <article className="landing-feature-card landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">chat</span>
              <h3>Message with context</h3>
              <p>Conversation, meeting links, attachments, and quick reactions stay connected to the booking.</p>
            </article>
            <article className="landing-feature-card landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">account_balance_wallet</span>
              <h3>Wallet clarity</h3>
              <p>Balance and ledger views make earnings, credits, refunds, and admin adjustments easy to understand.</p>
            </article>
          </div>
        </section>

        <section id="mentors" className="landing-section landing-mentors">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">Expert network</span>
            <h2>Premium mentor cards that feel human, not generated.</h2>
            <p>Real data appears automatically when mentors exist; polished featured profiles keep the page strong while the marketplace grows.</p>
          </div>

          <div className="landing-mentor-grid">
            {displayMentors.map((mentor) => {
              const tags = getSkillTags(mentor.skills);
              const rating = Number(mentor.averageRating || 0).toFixed(1);
              const reviews = Number(mentor.totalReviews || 0);
              const initials = getMentorInitials(mentor.fullName);

              return (
                <article className="landing-mentor-card landing-reveal" key={`${mentor.fullName}-${tags.join('-')}`}>
                  <div className="landing-mentor-image">
                    {mentor.profileImageUrl ? (
                      <OptimizedImage alt={`Portrait of ${mentor.fullName}`} src={mentor.profileImageUrl} />
                    ) : (
                      <span>{initials}</span>
                    )}
                    <span className={mentor.liveNow ? 'landing-presence is-live' : 'landing-presence'}>
                      {mentor.liveNow ? 'Live now' : 'Available'}
                    </span>
                  </div>
                  <div className="landing-mentor-body">
                    <div>
                      <h3>{mentor.fullName}</h3>
                      <p>{tags.join(' / ')}</p>
                    </div>
                    <div className="landing-mentor-meta">
                      <span><strong>{rating}</strong> rating</span>
                      <span><strong>{reviews || 'New'}</strong> reviews</span>
                    </div>
                    <button className="landing-text-button" type="button" onClick={() => openMentor(mentor)}>
                      View profile
                      <span className="material-symbols-outlined" aria-hidden="true">arrow_forward</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="workflow" className="landing-section landing-workflow">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">How it works</span>
            <h2>A cleaner path from intent to outcome.</h2>
          </div>

          <div className="landing-step-grid">
            {[
              ['01', 'Choose your goal', 'Define the skill, level, and outcome you want from the session.'],
              ['02', 'Match with a mentor', 'Compare skills, availability, proof, and pricing before you book.'],
              ['03', 'Meet and follow up', 'Use messages, session links, notes, and wallet history after the call.'],
            ].map(([number, title, text]) => (
              <article className="landing-step landing-reveal" key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="outcomes" className="landing-section landing-outcomes">
          <div className="landing-outcome-copy landing-reveal">
            <span className="landing-kicker">Production-ready polish</span>
            <h2>Designed for trust, focus, and repeat use.</h2>
            <p>
              The interface now leans into restrained color, strong spacing, crisp cards, and motion that supports the workflow
              instead of distracting from it.
            </p>
            <button className="landing-button landing-button-primary" type="button" onClick={onSelectSignup}>
              Create your profile
            </button>
          </div>
          <div className="landing-outcome-panel landing-reveal">
            <div className="landing-score-card">
              <span>Session quality</span>
              <strong>98%</strong>
              <p>learners felt more confident after guided feedback</p>
            </div>
            <div className="landing-check-list">
              <p><span className="material-symbols-outlined" aria-hidden="true">done</span> Accessible contrast and focus states</p>
              <p><span className="material-symbols-outlined" aria-hidden="true">done</span> Responsive layouts for all viewports</p>
              <p><span className="material-symbols-outlined" aria-hidden="true">done</span> Smooth, reduced-motion-aware animations</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <a className="landing-brand" href="#product" onClick={scrollToSection('product')}>
            <span className="landing-brand-mark">SS</span>
            <span>
              <strong>SkillSwap</strong>
              <small>Teach. Learn. Grow.</small>
            </span>
          </a>
          <p>Modern mentorship infrastructure for learners, mentors, and admins.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="#mentors" onClick={scrollToSection('mentors')}>Mentors</a>
          <a href="#workflow" onClick={scrollToSection('workflow')}>Workflow</a>
          <a href="#outcomes" onClick={scrollToSection('outcomes')}>Outcomes</a>
        </nav>
      </footer>
    </div>
  );
}
