import React, { useState, useRef, useEffect } from "react";
import useCommunityStats from "../hooks/useCommunityStats";
import "./CommunityStats.css";

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const displayRef = useRef(0);
  const rafRef = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const from = Number(displayRef.current);
    const to = Number(value);
    const dur = 900;
    cancelAnimationFrame(rafRef.current);
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (to - from) * t);
      setDisplay(v);
      displayRef.current = v;
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

export default function CommunityStats() {
  const { stats, loading } = useCommunityStats({ refreshInterval: 60_000 });

  if (loading)
    return (
      <section className="landing-section landing-stats">
        <div className="landing-section-heading landing-reveal">
          <span className="landing-kicker">Community</span>
          <h2>Trusted by a Growing Community</h2>
          <p>
            Every number below is generated from real activity happening on
            Mentorly.
          </p>
        </div>
        <div className="landing-stats-grid">
          {[0, 1, 2, 3, 4].map((i) => (
            <article
              className="landing-feature-card"
              key={i}
              style={{ minHeight: 140 }}
            >
              <div
                className="skeleton"
                style={{ height: 18, width: 180, marginBottom: 8 }}
              />
              <div className="skeleton" style={{ height: 34, width: 120 }} />
              <div
                className="skeleton"
                style={{ height: 12, width: 200, marginTop: 10 }}
              />
            </article>
          ))}
        </div>
      </section>
    );

  if (!stats) return null;

  const cards = [
    {
      key: "totalUsers",
      label: "Total registered users",
      icon: "group",
      value: stats.totalUsers,
    },
    {
      key: "activeUsers",
      label: "Users online",
      icon: "bolt",
      value: stats.activeUsers,
    },
    {
      key: "skillsOffered",
      label: "Skills offered",
      icon: "school",
      value: stats.skillsOffered,
    },
    {
      key: "completedSwaps",
      label: "Skill swaps completed",
      icon: "swap_horiz",
      value: stats.completedSwaps,
    },
    {
      key: "averageRating",
      label: "Average user rating",
      icon: "star",
      value: stats.averageRating,
    },
  ];

  return (
    <section className="landing-section landing-stats">
      <div className="landing-section-heading landing-reveal">
        <span className="landing-kicker">Community</span>
        <h2>Trusted by a Growing Community</h2>
        <p>
          Every number below is generated from real activity happening on
          Mentorly.
        </p>
      </div>
      <div className="landing-stats-grid">
        {cards.map((c, idx) => (
          <article
            className="landing-feature-card landing-stat-card landing-stat-animate"
            key={c.key}
            style={{ animationDelay: `${0.06 * idx}s` }}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {c.icon}
            </span>
            <p className="landing-stat-label">{c.label}</p>
            <p className="landing-stat-value">
              {c.key === "averageRating" ? (
                Number(c.value).toFixed(2)
              ) : (
                <CountUp value={c.value || 0} />
              )}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
