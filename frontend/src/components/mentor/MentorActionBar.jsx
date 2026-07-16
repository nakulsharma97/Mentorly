import { motion } from "framer-motion";

export default function MentorActionBar({
  mentor,
  hasSlots,
  isLoggedIn,
  onBookFirstSlot,
  onMessageMentor,
  onViewAvailability,
  onRequireLogin,
}) {
  const handleBook = () => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    onBookFirstSlot?.();
  };

  const handleMessage = () => {
    if (!isLoggedIn) {
      onRequireLogin?.();
      return;
    }
    onMessageMentor?.();
  };

  const handleAvailability = () => {
    onViewAvailability?.();
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: mentor?.fullName
            ? `${mentor.fullName} on SkillSwapper`
            : "SkillSwapper mentor",
          url,
        });
        return;
      } catch {
        // ignore share cancel
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      window.alert("Profile link copied to clipboard.");
    } catch {
      window.prompt("Copy this profile link", url);
    }
  };

  return (
    <motion.section
      className="dashboard-card mentor-action-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="mentor-action-copy">
        <div>
          <p className="muted">Fast track your mentorship</p>
          <h3>Designed for confident learners</h3>
        </div>
        <div className="mentor-action-pill-row">
          <span className="mentor-action-pill">Top-rated mentor</span>
          {mentor?.mentorVerified && (
            <span className="mentor-action-pill mentor-action-pill-verified">
              Verified expert
            </span>
          )}
        </div>
      </div>

      <div className="mentor-action-buttons">
        <button
          type="button"
          className="mentor-cta-btn mentor-cta-btn-primary"
          onClick={handleBook}
          disabled={!hasSlots}
        >
          {hasSlots ? "Book session" : "Check availability"}
        </button>
        <button
          type="button"
          className="mentor-secondary-btn mentor-cta-btn-secondary"
          onClick={handleMessage}
        >
          Message mentor
        </button>
      </div>

      <div className="mentor-action-extras">
        <button
          type="button"
          className="mentor-outline-btn"
          onClick={handleAvailability}
        >
          View availability
        </button>
        <button
          type="button"
          className="mentor-ghost-btn"
          onClick={handleShare}
        >
          Share profile
        </button>
      </div>
    </motion.section>
  );
}
