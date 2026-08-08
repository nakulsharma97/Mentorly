import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { normalizeSkills } from "../utils/skills";
import client from "../api/client";
import OptimizedImage from "../components/OptimizedImage";
import PremiumFooter from "../components/PremiumFooter";
import CommunityStats from "../components/CommunityStats";
import Testimonials from "../components/Testimonials";
import "./AuthPage.css";

const SECTION_IDS = ["product", "mentors", "workflow", "outcomes"];

const getMentorInitials = (fullName) => {
  const safeName = String(fullName || "").trim();
  if (!safeName) {
    return "M";
  }

  return safeName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
};

const getSkillTags = (rawSkills) => {
  // Unified with the shared normalizer — CSV / JSON-string / array shapes are
  // all handled identically; the landing card falls back to "Mentorship" when
  // a mentor has no skills.
  const tags = normalizeSkills(rawSkills, { limit: 2 });
  return tags.length ? tags : ["Mentorship"];
};

const scrollToSection = (sectionId) => (event) => {
  event.preventDefault();
  document
    .getElementById(sectionId)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function AuthPage({ onSelectLogin, onSelectSignup }) {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("product");
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [communityStats, setCommunityStats] = useState(null);

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
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  // Scroll-reveal observer. The mentor cards mount only AFTER the mentors
  // fetch resolves (mentorsLoading flips to false), so the observer must
  // re-run then — otherwise the freshly rendered cards keep opacity:0 forever
  // and the section looks "empty" while headings are visible.
  useEffect(() => {
    const elements = document.querySelectorAll(
      ".landing-reveal:not(.is-visible)",
    );
    if (!elements.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16 },
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [mentorsLoading]);

  useEffect(() => {
    let isMounted = true;

    client
      .get("/api/v1/users/mentors")
      .then((response) => {
        if (!isMounted) {
          return;
        }
        const list = Array.isArray(response?.data?.data)
          ? response.data.data
          : [];
        setMentors(list);
      })
      .catch(() => {
        if (isMounted) {
          setMentors([]);
        }
      })
      .finally(() => {
        if (isMounted) {
          setMentorsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Hero metrics are fed from the live community-stats endpoint (no fabricated
  // numbers). averageRating / completedSwaps / completionRate are all computed
  // server-side from real database rows.
  useEffect(() => {
    let isMounted = true;
    client
      .get("/api/v1/public/community-stats")
      .then((response) => {
        if (isMounted) {
          setCommunityStats(response?.data || null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setCommunityStats(null);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const [openFaq, setOpenFaq] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const displayMentors = useMemo(() => mentors.slice(0, 3), [mentors]);
  const mentorCountLabel = String(mentors.length);

  // Real hero metrics (null until the community-stats call resolves)
  const heroRating = communityStats ? Number(communityStats.averageRating || 0) : null;
  const heroSwaps = communityStats ? Number(communityStats.completedSwaps || 0) : null;
  const heroCompletion = communityStats ? Number(communityStats.completionRate || 0) : null;

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 800);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFaq = (idx) => {
    setOpenFaq((prev) => (prev === idx ? null : idx));
  };

  const faqItems = [
    {
      q: 'How does SkillSwap work?',
      a: 'SkillSwap connects learners with verified mentors for live, one-on-one sessions. Browse mentor profiles, find someone whose expertise matches your goals, book a session, and meet via the platform — with message context, session links, and follow-up tools all in one place.'
    },
    {
      q: 'How are mentors verified?',
      a: 'Every mentor profile goes through a manual verification process. We review professional background, skill endorsements, and teaching history before approving a mentor to offer sessions on the platform. Verified mentors are clearly marked on their profiles.'
    },
    {
      q: 'What payment methods are supported?',
      a: 'We support multiple payment methods including credit/debit cards (via Stripe), UPI (via Razorpay), and PayPal. All prices are in Indian Rupees (₹). Payments are held in escrow and released to mentors after the session is completed to ensure trust on both sides.'
    },
    {
      q: 'Can I get a refund if Im not satisfied?',
      a: 'Yes. If a session doesnt meet expectations, you can request a refund within 48 hours. Our admin team reviews each case and can issue a full or partial refund. Funds are held in escrow, so refunds are processed quickly.'
    },
    {
      q: 'How do I become a mentor?',
      a: 'Sign up as a mentor, complete your professional profile with your skills, experience, and certifications, and submit it for verification. Once approved, you can create sessions, set your availability, and start accepting bookings from learners.'
    },
    {
      q: 'Are sessions recorded?',
      a: 'By default, sessions are not recorded. However, mentors and learners can mutually agree to record a session. All communication and shared resources remain accessible through the platform after the session ends.'
    }
  ];

  // Generous headroom so the longest answer never clips on narrow viewports.
  const FAQ_MAX_HEIGHT = 480;


  const navLinkClass = (sectionId) =>
    activeSection === sectionId
      ? "landing-nav-link is-active"
      : "landing-nav-link";

  const closeMobileMenu = () => setMobileMenuOpen(false);

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
        <a
          className="landing-brand"
          href="#product"
          onClick={scrollToSection("product")}
        >
          <span className="landing-brand-mark">SS</span>
          <span>
            <strong>SkillSwap</strong>
            <small>Teach. Learn. Grow.</small>
          </span>
        </a>

        <div className="landing-nav-center" aria-label="Page sections">
          <a
            className={navLinkClass("product")}
            href="#product"
            onClick={(e) => { scrollToSection("product")(e); closeMobileMenu(); }}
          >
            Product
          </a>
          <a
            className={navLinkClass("mentors")}
            href="#mentors"
            onClick={(e) => { scrollToSection("mentors")(e); closeMobileMenu(); }}
          >
            Mentors
          </a>
          <a
            className={navLinkClass("workflow")}
            href="#workflow"
            onClick={(e) => { scrollToSection("workflow")(e); closeMobileMenu(); }}
          >
            Workflow
          </a>
          <a
            className={navLinkClass("outcomes")}
            href="#outcomes"
            onClick={(e) => { scrollToSection("outcomes")(e); closeMobileMenu(); }}
          >
            Outcomes
          </a>
        </div>

        {/* Hamburger toggle — visible only on mobile */}
        <button
          className={`landing-nav-hamburger${mobileMenuOpen ? ' is-open' : ''}`}
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={mobileMenuOpen}
        >
          <span className="landing-hamburger-line" />
          <span className="landing-hamburger-line" />
          <span className="landing-hamburger-line" />
        </button>

        {/* Mobile dropdown menu */}
        <div className={`landing-mobile-nav-dropdown${mobileMenuOpen ? ' is-open' : ''}`}>
          <div className="landing-mobile-nav-links">
            <a
              className={navLinkClass("product")}
              href="#product"
              onClick={(e) => { scrollToSection("product")(e); closeMobileMenu(); }}
            >
              Product
            </a>
            <a
              className={navLinkClass("mentors")}
              href="#mentors"
              onClick={(e) => { scrollToSection("mentors")(e); closeMobileMenu(); }}
            >
              Mentors
            </a>
            <a
              className={navLinkClass("workflow")}
              href="#workflow"
              onClick={(e) => { scrollToSection("workflow")(e); closeMobileMenu(); }}
            >
              Workflow
            </a>
            <a
              className={navLinkClass("outcomes")}
              href="#outcomes"
              onClick={(e) => { scrollToSection("outcomes")(e); closeMobileMenu(); }}
            >
              Outcomes
            </a>
          </div>
          <div className="landing-mobile-nav-actions">
            <button
              className="landing-button landing-button-ghost"
              type="button"
              onClick={() => { onSelectLogin(); closeMobileMenu(); }}
            >
              Log in
            </button>
            <button
              className="landing-button landing-button-dark"
              type="button"
              onClick={() => { onSelectSignup(); closeMobileMenu(); }}
            >
              Join free
            </button>
          </div>
        </div>

        <div className="landing-nav-actions">
          <button
            className="landing-button landing-button-ghost"
            type="button"
            onClick={onSelectLogin}
          >
            Log in
          </button>
          <button
            className="landing-button landing-button-dark"
            type="button"
            onClick={onSelectSignup}
          >
            Join free
          </button>
        </div>
      </nav>

      <main>
        <section id="product" className="landing-hero">
          <div className="landing-particles" aria-hidden="true">
            <div className="landing-particle" />
            <div className="landing-particle" />
            <div className="landing-particle" />
            <div className="landing-particle" />
            <div className="landing-particle" />
            <div className="landing-particle" />
            <div className="landing-particle" />
            <div className="landing-particle" />
          </div>
          <div className="landing-hero-copy landing-reveal is-visible">
            <span className="landing-eyebrow">
              <span aria-hidden="true" />
              Live mentorship for practical career growth
            </span>
            <h1>Learn from operators who have already built the path.</h1>
            <p>
              SkillSwap brings together verified mentors, live sessions, and
              clear follow-up workflows so learners can move faster with less
              friction.
            </p>
            <div className="landing-hero-actions">
              <a
                className="landing-button landing-button-primary"
                href="#mentors"
                onClick={scrollToSection("mentors")}
              >
                Find a Mentor
              </a>
              <button
                className="landing-button landing-button-soft"
                type="button"
                onClick={() => navigate("/become-a-mentor")}
              >
                Become a Mentor
              </button>
            </div>
            <dl className="landing-metrics" aria-label="Platform highlights">
              <div>
                <dt>{mentorCountLabel}</dt>
                <dd>mentor profiles</dd>
              </div>
              <div>
                <dt>{heroRating !== null ? heroRating.toFixed(1) : "—"}</dt>
                <dd>avg. session rating</dd>
              </div>
              <div>
                <dt>{heroSwaps !== null ? heroSwaps : "—"}</dt>
                <dd>skill swaps completed</dd>
              </div>
            </dl>
          </div>

          <div className="landing-hero-visual landing-reveal is-visible">
            <div className="landing-product-card">
              <div className="landing-product-header">
                <div>
                  <span>Mentor marketplace</span>
                  <strong>Find your next advantage</strong>
                </div>
                <span className="landing-live-pill">Live</span>
              </div>
              <div className="landing-hero-photo-shell">
                <OptimizedImage
                  className="landing-hero-photo"
                  alt="Mentor and learner reviewing a laptop in a modern workspace"
                  src="https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=82"
                  priority
                />
                <div className="landing-hero-badge">
                  <span
                    className="material-symbols-outlined"
                    aria-hidden="true"
                  >
                    verified
                  </span>
                  <div>
                    <strong>
                      {heroRating !== null
                        ? `${heroRating.toFixed(1)}/5 average`
                        : "—/5 average"}
                    </strong>
                    <p>Trusted by ambitious learners</p>
                  </div>
                </div>
                <div className="landing-hero-mini-card landing-hero-mini-card-top">
                  <span>Next match</span>
                  <strong>Senior product designer</strong>
                </div>
                <div className="landing-hero-mini-card landing-hero-mini-card-bottom">
                  <span>Focus areas</span>
                  <strong>System design • Growth</strong>
                </div>
              </div>
              <div
                className="landing-session-panel"
                aria-label="Session summary"
              >
                <div>
                  <span className="landing-avatar-stack" aria-hidden="true">
                    <span>M</span>
                    <span>L</span>
                  </span>
                  <p>1:1 live feedback</p>
                </div>
                <strong>Booked for Friday • 6:30 PM</strong>
              </div>
            </div>
          </div>
        </section>

        <div className="landing-section-divider" aria-hidden="true" />

        <section className="landing-logo-row" aria-label="Trusted categories">
          {[
            "Design Systems",
            "Full Stack",
            "Finance",
            "Marketing",
            "Data Science",
          ].map((item) => (
            <span key={item}>{item}</span>
          ))}
        </section>

        <section className="landing-section landing-feature-band">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">Built for momentum</span>
            <h2>Everything feels connected, from discovery to follow-up.</h2>
            <p>
              Cleaner flows, better hierarchy, and practical tools for sessions
              that do not end when the call ends.
            </p>
          </div>

          <div className="landing-feature-grid">
            <article className="landing-feature-card landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">
                travel_explore
              </span>
              <h3>Browse with confidence</h3>
              <p>
                Readable mentor cards, clear skill tags, ratings, and
                availability signals help learners decide faster.
              </p>
            </article>
            <article className="landing-feature-card landing-feature-card-dark landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">
                calendar_month
              </span>
              <h3>Book real sessions</h3>
              <p>
                Create sessions, request slots, accept or decline bookings, and
                keep the status visible everywhere.
              </p>
            </article>
            <article className="landing-feature-card landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">
                chat
              </span>
              <h3>Message with context</h3>
              <p>
                Conversation, meeting links, attachments, and quick reactions
                stay connected to the booking.
              </p>
            </article>
            <article className="landing-feature-card landing-reveal">
              <span className="material-symbols-outlined" aria-hidden="true">
                account_balance_wallet
              </span>
              <h3>Wallet clarity</h3>
              <p>
                Balance and ledger views make earnings, refunds, and
                admin adjustments easy to understand.
              </p>
            </article>
          </div>
        </section>

        <section id="mentors" className="landing-section landing-mentors">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">Expert network</span>
            <h2>
              Premium mentor cards that reflect real marketplace expertise.
            </h2>
            <p>
              Mentor profiles are loaded from the backend and shown only when
              verified mentors are available.
            </p>
          </div>

          <div className="landing-mentor-grid">
            {mentorsLoading ? (
              [0, 1, 2].map((key) => (
                <div
                  className="landing-mentor-card landing-mentor-card--skeleton"
                  key={key}
                >
                  <div className="skeleton landing-mentor-skeleton-img" />
                  <div className="landing-mentor-body">
                    <div className="skeleton landing-skeleton-line landing-skeleton-line--lg" />
                    <div className="skeleton landing-skeleton-line" />
                    <div className="skeleton landing-skeleton-line landing-skeleton-line--sm" />
                  </div>
                </div>
              ))
            ) : displayMentors.length === 0 ? (
              <div className="landing-mentor-empty">
                <span
                  className="landing-mentor-empty-icon material-symbols-outlined"
                  aria-hidden="true"
                >
                  groups
                </span>
                <p className="landing-mentor-empty-title">
                  No verified mentors available yet.
                </p>
                <p className="landing-mentor-empty-sub">
                  Check back soon for new mentors joining the marketplace.
                </p>
              </div>
            ) : (
              displayMentors.map((mentor) => {
                const tags = getSkillTags(mentor.skills);
                const rating = Number(mentor.averageRating || 0).toFixed(1);
                const reviews = Number(mentor.totalReviews || 0);
                const initials = getMentorInitials(mentor.fullName);

                return (
                  <article
                    className="landing-mentor-card landing-reveal"
                    key={`${mentor.fullName}-${tags.join("-")}`}
                  >
                    <div className="landing-mentor-image">
                      {mentor.profileImageUrl ? (
                        <OptimizedImage
                          alt={`Portrait of ${mentor.fullName}`}
                          src={mentor.profileImageUrl}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                      <span
                        className={
                          mentor.liveNow
                            ? "landing-presence is-live"
                            : "landing-presence"
                        }
                      >
                        {mentor.liveNow ? "Live now" : "Available"}
                      </span>
                    </div>
                    <div className="landing-mentor-body">
                      <div>
                        <h3>{mentor.fullName}</h3>
                        <p>{tags.join(" / ")}</p>
                      </div>
                      <div className="landing-mentor-meta">
                        <span>
                          <strong>{rating}</strong> rating
                        </span>
                        <span>
                          <strong>{reviews || "New"}</strong> reviews
                        </span>
                      </div>
                      <button
                        className="landing-text-button"
                        type="button"
                        onClick={() => openMentor(mentor)}
                      >
                        View profile
                        <span
                          className="material-symbols-outlined"
                          aria-hidden="true"
                        >
                          arrow_forward
                        </span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section id="workflow" className="landing-section landing-workflow">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">How it works</span>
            <h2>A cleaner path from intent to outcome.</h2>
          </div>

          <div className="landing-step-grid">
            {[
              [
                "01",
                "Choose your goal",
                "Define the skill, level, and outcome you want from the session.",
              ],
              [
                "02",
                "Match with a mentor",
                "Compare skills, availability, proof, and pricing before you book.",
              ],
              [
                "03",
                "Meet and follow up",
                "Use messages, session links, notes, and wallet history after the call.",
              ],
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
              The interface now leans into restrained color, strong spacing,
              crisp cards, and motion that supports the workflow instead of
              distracting from it.
            </p>
            <button
              className="landing-button landing-button-primary"
              type="button"
              onClick={onSelectSignup}
            >
              Create your profile
            </button>
          </div>
          <div className="landing-outcome-panel landing-reveal">
            <div className="landing-score-card">
              <span>Session completion</span>
              <strong>
                {heroCompletion !== null ? `${heroCompletion.toFixed(0)}%` : "—"}
              </strong>
              <p>of bookings completed on SkillSwap</p>
            </div>
            <div className="landing-check-list">
              <p>
                <span className="material-symbols-outlined" aria-hidden="true">
                  done
                </span>{" "}
                Accessible contrast and focus states
              </p>
              <p>
                <span className="material-symbols-outlined" aria-hidden="true">
                  done
                </span>{" "}
                Responsive layouts for all viewports
              </p>
              <p>
                <span className="material-symbols-outlined" aria-hidden="true">
                  done
                </span>{" "}
                Smooth, reduced-motion-aware animations
              </p>
            </div>
          </div>
        </section>

        <CommunityStats />

        <div className="landing-section-divider" aria-hidden="true" />

        <Testimonials onShareReview={onSelectSignup} />

        <div className="landing-section-divider-wave" aria-hidden="true" />

        <section className="landing-faq" id="faq">
          <div className="landing-section-heading landing-reveal">
            <span className="landing-kicker">Questions?</span>
            <h2>Frequently asked questions.</h2>
            <p>
              Everything you need to know about SkillSwap. Still have questions?
              Reach out to our support team.
            </p>
          </div>
          <div className="landing-faq-grid">
            {faqItems.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <article
                  key={idx}
                  // NOTE: intentionally NO `landing-reveal` here. The reveal
                  // observer adds `is-visible` imperatively via the DOM, but
                  // React recomputes this className on every toggle (is-open),
                  // wiping `is-visible` and snapping the item to opacity:0 —
                  // which made the whole card (question + answer) invisible
                  // after a click. FAQ items are always visible; only the
                  // answer expands/collapses.
                  className={`landing-faq-item${isOpen ? ' is-open' : ''}`}
                >
                  <button
                    className="landing-faq-question"
                    type="button"
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-answer-${idx}`}
                  >
                    <span>{item.q}</span>
                    <span className="landing-faq-question-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
                  </button>
                  <div
                    id={`faq-answer-${idx}`}
                    className={`landing-faq-answer${isOpen ? ' is-open' : ''}`}
                    role="region"
                    style={{
                      maxHeight: isOpen ? FAQ_MAX_HEIGHT : 0,
                      opacity: isOpen ? 1 : 0,
                      overflow: 'hidden',
                      transition: 'max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease',
                    }}
                  >
                    <p>{item.a}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="landing-cta-band">
          <div className="landing-cta-card landing-reveal">
            <div className="landing-cta-shimmer" aria-hidden="true" />
            <span className="landing-cta-kicker">
              <span aria-hidden="true">✨</span>
              Join thousands of learners
            </span>
            <h2>Ready to accelerate your career?</h2>
            <p>
              Sign up free, find your mentor, and start learning from industry
              experts who have already built the path.
            </p>
            <div className="landing-cta-actions">
              <button
                className="landing-button landing-button-primary"
                type="button"
                onClick={onSelectSignup}
              >
                Get started free
              </button>
              <button
                className="landing-button landing-button-ghost"
                type="button"
                onClick={scrollToSection('mentors')}
              >
                Browse mentors
              </button>
            </div>
          </div>
        </section>
      </main>

      <button
        className={`landing-back-to-top${showBackToTop ? ' is-visible' : ''}`}
        type="button"
        onClick={scrollToTop}
        aria-label="Back to top"
        title="Back to top"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          arrow_upward
        </span>
      </button>

      <div className="landing-mobile-cta">
        <div className="landing-mobile-cta-inner">
          <button
            className="landing-button landing-button-ghost"
            type="button"
            onClick={onSelectLogin}
          >
            Log in
          </button>
          <button
            className="landing-button landing-button-dark"
            type="button"
            onClick={onSelectSignup}
          >
            Join free
          </button>
        </div>
      </div>

      <PremiumFooter onScrollToSection={scrollToSection} />
    </div>
  );
}
