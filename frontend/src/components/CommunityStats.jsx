import React, { useEffect, useState, useRef } from "react";
import client from "../api/client";
import { motion } from "framer-motion";
import "./CommunityStats.css";

function useInterval(callback, delay) {
  const savedRef = useRef();
  useEffect(() => {
    savedRef.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay == null) return;
    const id = setInterval(() => savedRef.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function CountUp({ value }) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef();
  useEffect(() => {
    const start = performance.now();
    const from = Number(display);
    const to = Number(value);
    const dur = 900;
    cancelAnimationFrame(rafRef.current);
    function tick(now) {
      const t = Math.min(1, (now - start) / dur);
      const v = Math.round(from + (to - from) * t);
      setDisplay(v);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);
  return <span>{display.toLocaleString()}</span>;
}

export default function CommunityStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const res = await client.get("/api/v1/public/community-stats");
      setStats(res.data);
    } catch (e) {
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);
  // refresh only activeUsers every 60s
  useInterval(() => {
    client
      .get("/api/v1/public/community-stats")
      .then((r) => {
        setStats(() => ({ ...r.data, activeUsers: r.data.activeUsers }));
      })
      .catch(() => {});
  }, 60000);

  if (loading)
    return (
      <section className="landing-section landing-stats">
        <div className="landing-section-heading landing-reveal">
          <span className="landing-kicker">Community</span>
          <h2>Trusted by a Growing Community</h2>
          <p>
            Every number below is generated from real activity happening on
            SkillSwapper.
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
      label: "Total Registered Users",
      emoji: "👥",
      value: stats.totalUsers,
    },
    {
      key: "activeUsers",
      label: "Users Online",
      emoji: "🟢",
      value: stats.activeUsers,
    },
    {
      key: "skillsOffered",
      label: "Skills Offered",
      emoji: "📚",
      value: stats.skillsOffered,
    },
    {
      key: "completedSwaps",
      label: "Successful Skill Swaps",
      emoji: "🤝",
      value: stats.completedSwaps,
    },
    {
      key: "averageRating",
      label: "Average User Rating",
      emoji: "⭐",
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
          SkillSwapper.
        </p>
      </div>
      <div className="landing-stats-grid">
        {cards.map((c, idx) => (
          <motion.article
            className="landing-feature-card landing-stat-card"
            key={c.key}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * idx, duration: 0.6 }}
            whileHover={{
              translateY: -6,
              boxShadow: "0 28px 70px rgba(16,32,29,0.15)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }} aria-hidden>
                {c.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: "var(--lp-muted)", fontWeight: 900 }}>
                  {c.label}
                </div>
                <div style={{ marginTop: 8, fontSize: 28, fontWeight: 900 }}>
                  {c.key === "averageRating" ? (
                    <strong>{Number(c.value).toFixed(2)}</strong>
                  ) : (
                    <CountUp value={c.value || 0} />
                  )}
                </div>
              </div>
            </div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
