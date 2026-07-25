import { useEffect, useRef } from "react";
import Icon from "../../common/dashboard/Icon";

/**
 * Premium page hero for mentor list pages (Students, Calendar, Reviews),
 * mirroring the learner-side PageHero so both roles feel consistent.
 * Actions render on the right of the copy via {children}.
 * Enhanced with glassmorphism, floating icon, and geometric decorations.
 */
export default function MentorPageHero({ eyebrow, icon, title, sub, children }) {
  const watermarkRef = useRef(null);

  useEffect(() => {
    // Subtle parallax effect for watermark icon on mousemove
    const handleMouseMove = (e) => {
      if (!watermarkRef.current) return;
      const rect = watermarkRef.current.closest('.mp-hero')?.getBoundingClientRect();
      if (!rect) return;
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      watermarkRef.current.style.transform = `translateY(-50%) translate(${x * 12}px, ${y * 8}px)`;
    };

    const hero = watermarkRef.current?.closest('.mp-hero');
    if (hero) {
      hero.addEventListener('mousemove', handleMouseMove, { passive: true });
    }
    return () => {
      if (hero) {
        hero.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, []);

  return (
    <div className="mp-hero md-animate">
      {/* Geometric pattern overlay */}
      <div className="mp-hero__pattern" aria-hidden="true">
        <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="350" cy="50" r="120" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
          <circle cx="200" cy="200" r="180" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <circle cx="380" cy="350" r="80" stroke="currentColor" strokeWidth="0.5" opacity="0.25" />
          <rect x="280" y="100" width="60" height="60" rx="12" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <rect x="320" y="280" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />
        </svg>
      </div>

      {icon ? (
        <span className="mp-hero__watermark" ref={watermarkRef} aria-hidden="true">
          <Icon name={icon} />
        </span>
      ) : null}

      <div className="mp-hero__content">
        {eyebrow ? (
          <div className="mp-hero__eyebrow">
            <Icon name={icon} /> {eyebrow}
          </div>
        ) : null}
        <h1>{title}</h1>
        {sub ? <p className="mp-hero__sub">{sub}</p> : null}
        {children ? <div className="mp-hero__actions">{children}</div> : null}
      </div>
    </div>
  );
}
