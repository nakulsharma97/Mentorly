import { useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import Icon from "../../../common/dashboard/Icon";
import { normalizeSkills } from "../../../../utils/skills";
import { Avatar, EmptyState, Reveal, SectionHeader } from "./ui";

function MentorCard({ mentor, index }) {
  const skills = normalizeSkills(mentor.skills);
  const rating = Number(mentor.averageRating || 0);
  const price = Number(mentor.minSessionPrice || 0);

  return (
    <motion.article
      className="lp-mentor"
      whileHover={{ y: -6, transition: { type: "spring", stiffness: 300, damping: 22 } }}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="lp-mentor__head">
        <Avatar url={mentor.profileImageUrl} name={mentor.fullName} size={54} />
        {mentor.liveNow && <span className="lp-mentor__live"><span /> Live</span>}
        <span className="lp-mentor__ai">
          <Icon name="auto_awesome" /> AI Picked
        </span>
      </div>
      <div className="lp-mentor__name-row">
        <h3>{mentor.fullName || "Mentor"}</h3>
        {mentor.mentorVerified && <Icon name="verified" className="lp-mentor__verified" />}
      </div>
      <div className="lp-mentor__rating">
        {Array.from({ length: 5 }, (_, i) => (
          <Icon
            key={i}
            name="star"
            className={i < Math.round(rating) ? "is-on" : ""}
            style={i < Math.round(rating) ? { fontVariationSettings: '"FILL" 1' } : undefined}
          />
        ))}
        <span>{rating ? rating.toFixed(1) : "New"} · {mentor.totalReviews || 0} reviews</span>
      </div>
      <div className="lp-mentor__skills">
        {skills.slice(0, 3).map((s) => (
          <span key={s}>{s}</span>
        ))}
        {skills.length > 3 && <span>+{skills.length - 3}</span>}
      </div>
      <div className="lp-mentor__meta">
        <span><Icon name="work" /> {mentor.yearsOfExperience || 3}+ yrs</span>
        <span><Icon name="schedule" /> {mentor.availability || "Flexible"}</span>
      </div>
      <div className="lp-mentor__price">
        <strong>{price > 0 ? `$${price}` : "Free"}</strong>
        <span>/ session</span>
      </div>
      <div className="lp-mentor__actions">
        <Link to={`/mentors/${mentor.id}`} className="lp-btn lp-btn--primary lp-btn--sm">
          <Icon name="event_available" /> Book
        </Link>
        <Link to="/learner/messages" className="lp-btn lp-btn--outline lp-btn--sm">
          <Icon name="chat_bubble" />
        </Link>
        <Link to={`/mentors/${mentor.id}`} className="lp-btn lp-btn--ghost lp-btn--sm">
          <Icon name="person" /> Profile
        </Link>
      </div>
    </motion.article>
  );
}

/** Horizontal carousel of recommended mentors. */
export default function MentorCarousel({ mentors }) {
  const scrollerRef = useRef(null);

  const scroll = (dir) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <section className="lp-section" aria-label="Recommended mentors">
      <Reveal>
        <SectionHeader
          icon="group_add"
          title="Mentors Recommended for You"
          subtitle="AI-matched mentors based on your current milestone and skill gaps"
          action={() => scroll(1)}
          actionLabel="Scroll"
        />
      </Reveal>

      {mentors.length === 0 ? (
        <Reveal delay={0.05}>
          <EmptyState
            icon="person_search"
            title="No mentors to show yet"
            description="Explore the mentor marketplace and save favorites — we'll surface the best matches here."
            actions={
              <Link to="/learner/mentors" className="lp-btn lp-btn--primary">
                <Icon name="person_search" /> Find Mentors
              </Link>
            }
          />
        </Reveal>
      ) : (
        <div className="lp-mentor-rail" ref={scrollerRef}>
          {mentors.map((m, i) => (
            <MentorCard key={m.id ?? m.fullName ?? i} mentor={m} index={i} />
          ))}
        </div>
      )}
    </section>
  );
}
