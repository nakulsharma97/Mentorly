import React, { useEffect, useState } from "react";
import client from "../api/client";
import { motion } from "framer-motion";

export default function Testimonials({ onShareReview }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    client
      .get("/api/v1/public/testimonials")
      .then((r) => {
        if (mounted) {
          setItems(r.data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setItems([]);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (loading)
    return (
      <section className="landing-section landing-testimonials">
        <div className="landing-section-heading landing-reveal">
          <span className="landing-kicker">Voices</span>
          <h2>What Our Learners Say</h2>
          <p>
            Real feedback from learners and mentors who have exchanged skills
            through SkillSwapper.
          </p>
        </div>
        <div className="landing-mentor-grid">
          {[0, 1, 2].map((i) => (
            <article
              className="landing-mentor-card"
              key={i}
              style={{ minHeight: 180 }}
            >
              <div className="landing-mentor-body">
                <div className="skeleton" style={{ height: 18, width: 200 }} />
                <div
                  className="skeleton"
                  style={{ height: 12, width: 260, marginTop: 8 }}
                />
              </div>
            </article>
          ))}
        </div>
      </section>
    );

  if (!items || items.length === 0)
    return (
      <section className="landing-section landing-testimonials">
        <div className="landing-section-heading landing-reveal">
          <span className="landing-kicker">Voices</span>
          <h2>What Our Learners Say</h2>
          <p>
            Real feedback from learners and mentors who have exchanged skills
            through SkillSwapper.
          </p>
        </div>
        <div className="landing-outcome-copy">
          <p>Be the first member to share your learning experience.</p>
          <button
            className="landing-button landing-button-primary"
            type="button"
            onClick={onShareReview}
          >
            Share your review
          </button>
        </div>
      </section>
    );

  return (
    <section className="landing-section landing-testimonials">
      <div className="landing-section-heading landing-reveal">
        <span className="landing-kicker">Voices</span>
        <h2>What Our Learners Say</h2>
        <p>
          Real feedback from learners and mentors who have exchanged skills
          through SkillSwapper.
        </p>
      </div>

      <div className="landing-mentor-grid">
        {items.map((it, idx) => (
          <motion.article
            key={it.reviewId}
            className="landing-mentor-card landing-reveal"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 * idx }}
          >
            <div className="landing-mentor-image">
              <img
                src={it.reviewerProfileImageUrl || "/default-avatar.png"}
                alt=""
              />
              <span
                className={
                  it.reviewerRole &&
                  it.reviewerRole.toLowerCase().includes("mentor")
                    ? "landing-presence"
                    : "landing-presence"
                }
              >
                {it.reviewerRole}
              </span>
            </div>
            <div className="landing-mentor-body">
              <h3>
                {it.reviewerName} {it.reviewerVerified ? "✓" : ""}
              </h3>
              <div className="landing-mentor-meta">
                <span>
                  <strong>{it.completedSwaps}</strong> swaps
                </span>
                <span>
                  <strong>{it.skillExchanged || "—"}</strong>
                </span>
              </div>
              <p style={{ marginTop: 12 }}>{it.reviewText}</p>
              <div style={{ marginTop: 12, color: "var(--landing-muted)" }}>
                {new Date(it.reviewDate).toLocaleDateString()} • {it.rating} ⭐
              </div>
            </div>
          </motion.article>
        ))}
      </div>
      {items.length > 6 && (
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 18 }}
        >
          <button className="landing-button">View All Reviews</button>
        </div>
      )}
    </section>
  );
}
