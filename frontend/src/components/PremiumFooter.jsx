import React, { useState } from "react";
import "./PremiumFooter.css";

export default function PremiumFooter({ onScrollToSection }) {
  const [language, setLanguage] = useState("en");
  const [theme, setTheme] = useState("light");

  const scrollToSection = (sectionId) => (event) => {
    event.preventDefault();
    if (onScrollToSection) {
      onScrollToSection(sectionId);
    }
  };

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const handleThemeToggle = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <footer className="premium-footer">
      {/* Smooth divider */}
      <div className="footer-divider"></div>

      {/* Main footer content */}
      <div className="footer-content">
        <div className="footer-container">
          {/* Column 1: Brand */}
          <div className="footer-column footer-brand">
            <div className="brand-badge">
              <div className="brand-logo">SS</div>
            </div>
            <div className="brand-info">
              <h3 className="brand-name">SkillSwap</h3>
              <p className="brand-tagline">Teach. Learn. Grow.</p>
              <p className="brand-description">
                A collaborative platform connecting learners and mentors through
                structured skill exchange and guided learning.
              </p>
            </div>
          </div>

          {/* Column 2: Platform */}
          <div className="footer-column">
            <h4 className="footer-column-title">Platform</h4>
            <nav aria-label="Platform links">
              <ul className="footer-links">
                <li>
                  <a
                    href="#mentors"
                    onClick={scrollToSection("mentors")}
                    className="footer-link"
                  >
                    Find Mentors
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Become a Mentor
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Live Sessions
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Roadmaps
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Skill Exchange
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Column 3: Resources */}
          <div className="footer-column">
            <h4 className="footer-column-title">Resources</h4>
            <nav aria-label="Resource links">
              <ul className="footer-links">
                <li>
                  <a href="#" className="footer-link">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    FAQs
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Community
                  </a>
                </li>
              </ul>
            </nav>
          </div>

          {/* Column 4: Company */}
          <div className="footer-column">
            <h4 className="footer-column-title">Company</h4>
            <nav aria-label="Company links">
              <ul className="footer-links">
                <li>
                  <a href="#" className="footer-link">
                    About Us
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link">
                    Terms & Conditions
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>

      {/* Bottom footer bar */}
      <div className="footer-bottom">
        <div className="footer-bottom-container">
          {/* Left: Copyright */}
          <div className="footer-bottom-left">
            <p className="footer-copyright">
              © 2026 SkillSwap. All rights reserved.
            </p>
          </div>

          {/* Center: Tagline */}
          <div className="footer-bottom-center">
            <p className="footer-tagline">
              Built with <span aria-hidden="true">❤️</span><span className="sr-only">love</span> for learners and mentors.
            </p>
          </div>

          {/* Right: Utilities */}
          <div className="footer-bottom-right">
            <div className="footer-utilities">
              <select
                className="footer-language-selector"
                value={language}
                onChange={handleLanguageChange}
                aria-label="Language selector"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
              </select>

              <button
                className="footer-theme-toggle"
                onClick={handleThemeToggle}
                aria-label="Toggle theme"
                title="Toggle light/dark theme"
              >
                {theme === "light" ? "🌙" : "☀️"}
              </button>

              <span className="footer-version">v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
