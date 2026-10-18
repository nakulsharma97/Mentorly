import React from "react";
import { Link } from "react-router";
import "./PremiumFooter.css";

/**
 * Landing footer: compact gradient CTA banner followed by a light, single-row
 * footer bar (brand · navigation · legal). Only links backed by real routes or
 * landing anchors are rendered — no placeholder destinations.
 */
export default function PremiumFooter({ onScrollToSection, onSelectSignup }) {
  const goToSection = (sectionId) => (event) => {
    if (event) event.preventDefault();
    if (typeof onScrollToSection === "function") {
      const handler = onScrollToSection(sectionId);
      if (typeof handler === "function") {
        handler(event);
        return;
      }
    }
    document
      .getElementById(sectionId)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // AuthPage owns the auth modal and does not currently pass a signup handler
  // down to the footer, so fall back to the landing page's existing "Join free"
  // control — this keeps the exact same signup flow instead of inventing one.
  const handleSignup = () => {
    if (typeof onSelectSignup === "function") {
      onSelectSignup();
      return;
    }
    document
      .querySelector(".landing-nav-actions .landing-button-dark")
      ?.click();
  };

  return (
    <footer className="premium-footer">
      {/* ── Compact CTA banner ── */}
      <div className="mf-cta-shell">
        <section className="mf-cta" aria-labelledby="mf-cta-title">
          <span className="mf-cta-orb mf-cta-orb-left" aria-hidden="true" />
          <span className="mf-cta-orb mf-cta-orb-right" aria-hidden="true" />
          <span className="mf-cta-dot mf-cta-dot-left" aria-hidden="true" />
          <span className="mf-cta-dot mf-cta-dot-right" aria-hidden="true" />

          <div className="mf-cta-inner">
            <span className="mf-cta-badge">Free to start</span>
            <h2 id="mf-cta-title">Ready to find your mentor?</h2>
            <p>
              Sign up free, browse mentors who have been where you want to go,{" "}
              <span className="mf-cta-line">and book your first session.</span>
            </p>
            <div className="mf-cta-actions">
              <button
                className="mf-cta-primary"
                type="button"
                onClick={handleSignup}
              >
                Get started free
              </button>
              <a
                className="mf-cta-secondary"
                href="#mentors"
                onClick={goToSection("mentors")}
              >
                Browse mentors
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer bar ── */}
      <div className="mf-bar">
        <div className="mf-bar-inner">
          <div className="mf-brand">
            <span className="mf-logo" aria-hidden="true">
              ML
            </span>
            <div className="mf-brand-text">
              <strong>Mentorly</strong>
              <span>Teach. Learn. Grow.</span>
            </div>
          </div>

          <nav className="mf-nav" aria-label="Footer navigation">
            <a href="#mentors" onClick={goToSection("mentors")}>
              Find Mentors
            </a>
            <Link to="/become-a-mentor">Become a Mentor</Link>
            <a href="#faq" onClick={goToSection("faq")}>
              FAQs
            </a>
          </nav>

          <div className="mf-meta">
            <p>© 2026 Mentorly. All rights reserved.</p>
            <p>
              Built with <span aria-hidden="true">❤️</span>
              <span className="mf-sr-only">love</span> for learners and mentors.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
