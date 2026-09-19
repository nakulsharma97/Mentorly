import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import useCommunityStats from "../hooks/useCommunityStats";
import usePublicData from "../hooks/usePublicData";
import { useOptionalTheme } from "../context/ThemeContext";
import LandingSkeleton from "../components/LandingSkeleton";
import "./AuthPage.css";

// Eager: above the fold (hero + nav)
import LandingHero from "./landing/LandingHero";

// Lazy: everything below the fold — only load when scrolled near viewport
const LandingFeatures = lazy(() => import("./landing/LandingFeatures"));
const LandingMentors = lazy(() => import("./landing/LandingMentors"));
const LandingWorkflow = lazy(() => import("./landing/LandingWorkflow"));
const LandingOutcomes = lazy(() => import("./landing/LandingOutcomes"));
const LandingFAQ = lazy(() => import("./landing/LandingFAQ"));
const LandingCTA = lazy(() => import("./landing/LandingCTA"));
const CommunityStats = lazy(() => import("../components/CommunityStats"));
const Testimonials = lazy(() => import("../components/Testimonials"));
const PremiumFooter = lazy(() => import("../components/PremiumFooter"));

const SECTION_IDS = ["product", "mentors", "workflow", "outcomes"];

const scrollToSection = (sectionId) => (event) => {
  event.preventDefault();
  document
    .getElementById(sectionId)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function AuthPage({ onSelectLogin, onSelectSignup }) {
  const navigate = useNavigate();
  const themeCtx = useOptionalTheme();
  const [activeSection, setActiveSection] = useState("product");
  const { mentors = [], mentorsLoading } = usePublicData({
    fetchMentors: true,
    fetchTestimonials: false,
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { stats: communityStats } = useCommunityStats();

  useEffect(() => {
    const updateActiveSection = () => {
      const current = SECTION_IDS.findLast((sectionId) => {
        const element = document.getElementById(sectionId);
        return element && element.getBoundingClientRect().top <= 140;
      });
      if (current) setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  useEffect(() => {
    // Scroll-reveal via IntersectionObserver — zero CPU cost when idle.
    // Falls back to immediate reveal if IO is unavailable.
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".landing-reveal").forEach((el) => el.classList.add("is-visible"));
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
      { rootMargin: "0px 0px -60px 0px", threshold: 0.01 },
    );

    // Observe all current and future landing-reveal elements.
    const revealEls = document.querySelectorAll(".landing-reveal");
    revealEls.forEach((el) => observer.observe(el));

    // Also observe future elements added by lazy chunks.
    const mutationObserver = new MutationObserver(() => {
      document.querySelectorAll(".landing-reveal:not(.is-visible)").forEach((el) => observer.observe(el));
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 800);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const heroRating = communityStats
    ? Number(communityStats.averageRating || 0)
    : null;
  const heroSwaps = communityStats
    ? Number(communityStats.completedSwaps || 0)
    : null;
  const heroCompletion = communityStats
    ? Number(communityStats.completionRate || 0)
    : null;

  const navLinkClass = (sectionId) =>
    activeSection === sectionId
      ? "landing-nav-link is-active"
      : "landing-nav-link";

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="landing-shell">
      {/* ═══ NAV ═══ */}
      <nav className="landing-nav" aria-label="Public navigation">
        <a
          className="landing-brand"
          href="#product"
          onClick={scrollToSection("product")}
        >
          <span className="landing-brand-mark">ML</span>
          <span>
            <strong>Mentorly</strong>
            <small>Teach. Learn. Grow.</small>
          </span>
        </a>

        <div className="landing-nav-center" aria-label="Page sections">
          {SECTION_IDS.map((id) => (
            <a
              key={id}
              className={navLinkClass(id)}
              href={`#${id}`}
              onClick={(e) => {
                scrollToSection(id)(e);
                closeMobileMenu();
              }}
            >
              {id.charAt(0).toUpperCase() + id.slice(1)}
            </a>
          ))}
        </div>

        <button
          className={`landing-nav-hamburger${mobileMenuOpen ? " is-open" : ""}`}
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={mobileMenuOpen}
        >
          <span className="landing-hamburger-line" />
          <span className="landing-hamburger-line" />
          <span className="landing-hamburger-line" />
        </button>

        <div className={`landing-mobile-nav-dropdown${mobileMenuOpen ? " is-open" : ""}`}>
          <div className="landing-mobile-nav-links">
            {SECTION_IDS.map((id) => (
              <a
                key={id}
                className={navLinkClass(id)}
                href={`#${id}`}
                onClick={(e) => {
                  scrollToSection(id)(e);
                  closeMobileMenu();
                }}
              >
                {id.charAt(0).toUpperCase() + id.slice(1)}
              </a>
            ))}
          </div>
          <div className="landing-mobile-nav-actions">
            <button className="landing-theme-toggle" type="button" onClick={themeCtx?.toggle} aria-label="Toggle theme" style={{ width: "100%", minHeight: 46 }}>
              <span className="material-symbols-outlined">
                {themeCtx?.isDark ? "light_mode" : "dark_mode"}
              </span>
            </button>
            <button className="landing-button landing-button-ghost" type="button" onClick={() => { onSelectLogin(); closeMobileMenu(); }}>
              Log in
            </button>
            <button className="landing-button landing-button-dark" type="button" onClick={() => { onSelectSignup(); closeMobileMenu(); }}>
              Join free
            </button>
          </div>
        </div>

        <div className="landing-nav-actions">
          <button className="landing-theme-toggle" type="button" onClick={themeCtx?.toggle} aria-label="Toggle theme">
            <span className="material-symbols-outlined">
              {themeCtx?.isDark ? "light_mode" : "dark_mode"}
            </span>
          </button>
          <button className="landing-button landing-button-ghost" type="button" onClick={onSelectLogin}>
            Log in
          </button>
          <button className="landing-button landing-button-dark" type="button" onClick={onSelectSignup}>
            Join free
          </button>
        </div>
      </nav>

      {/* ═══ MAIN ═══ */}
      <main>
        {/* Hero — eager, above fold */}
        <LandingHero
          mentorCount={mentors.length}
          heroRating={heroRating}
          heroSwaps={heroSwaps}
          navigate={navigate}
        />

        <div className="landing-section-divider" aria-hidden="true" />

        {/* Everything below — lazy, off-screen */}
        <Suspense fallback={<LandingSkeleton variant="features" />}><LandingFeatures /></Suspense>

        <Suspense fallback={<LandingSkeleton variant="mentors" />}>
          <LandingMentors
            mentors={mentors}
            mentorsLoading={mentorsLoading}
            onSelectSignup={onSelectSignup}
          />
        </Suspense>

        <Suspense fallback={<LandingSkeleton variant="workflow" />}><LandingWorkflow /></Suspense>

        <Suspense fallback={<LandingSkeleton />}>
          <LandingOutcomes heroCompletion={heroCompletion} onSelectSignup={onSelectSignup} />
        </Suspense>

        <Suspense fallback={<LandingSkeleton />}><CommunityStats /></Suspense>

        <div className="landing-section-divider" aria-hidden="true" />

        <Suspense fallback={<LandingSkeleton />}><Testimonials onShareReview={onSelectSignup} /></Suspense>

        <div className="landing-section-divider-wave" aria-hidden="true" />

        <Suspense fallback={<LandingSkeleton />}><LandingFAQ /></Suspense>

        <Suspense fallback={<LandingSkeleton />}><LandingCTA onSelectSignup={onSelectSignup} /></Suspense>
      </main>

      {/* ═══ FOOTER / UTILS ═══ */}
      <button
        className={`landing-back-to-top${showBackToTop ? " is-visible" : ""}`}
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        title="Back to top"
      >
        <span className="material-symbols-outlined" aria-hidden="true">
          arrow_upward
        </span>
      </button>

      <div className="landing-mobile-cta">
        <div className="landing-mobile-cta-inner">
          <button className="landing-button landing-button-ghost" type="button" onClick={onSelectLogin}>
            Log in
          </button>
          <button className="landing-button landing-button-dark" type="button" onClick={onSelectSignup}>
            Join free
          </button>
        </div>
      </div>

      <Suspense fallback={null}>
        <PremiumFooter onScrollToSection={scrollToSection} />
      </Suspense>  
    </div>
  );
}
