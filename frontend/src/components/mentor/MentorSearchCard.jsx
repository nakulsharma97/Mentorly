import { memo } from "react";
import { useNavigate } from "react-router-dom";

/**
 * MentorSearchCard Component
 * Displays a single mentor search result in the grid
 * Memoized for performance when lists are long
 */
const MentorSearchCard = memo(
  function MentorSearchCard({
    result,
    onBookNearestSession,
    onFindSimilar,
  }) {
    const navigate = useNavigate();

    if (!result) {
      return null;
    }

    const handleVisitProfile = (e) => {
      e.preventDefault();
      navigate(`/mentors/${result.mentorId}`);
    };

    return (
      <article className="mentor-result-card">
        <div className="mentor-result-card-head">
          <div>
            <p className="mentor-result-label">Mentor</p>
            <h4>{result.mentorName}</h4>
          </div>
          <div className="mentor-result-score">
            <strong>{result.score}</strong>
            <span>score</span>
          </div>
        </div>

        <div className="mentor-result-meta-grid">
          <div>
            <span>Skill match</span>
            <strong>{result.skillMatch}</strong>
          </div>
          <div>
            <span>Rating</span>
            <strong>{result.ratingScore}</strong>
          </div>
          <div>
            <span>Response</span>
            <strong>{result.responseTimeScore}</strong>
          </div>
          <div>
            <span>Completion</span>
            <strong>{result.completionRateScore}</strong>
          </div>
        </div>

        <div className="mentor-result-card-actions">
          <a
            className="meeting-link"
            onClick={handleVisitProfile}
            href={`/mentors/${result.mentorId}`}
          >
            Open public profile
          </a>
          <button
            type="button"
            onClick={() => onBookNearestSession(result.mentorId)}
          >
            Book now
          </button>
          <button type="button" onClick={() => onFindSimilar(result)}>
            Find similar
          </button>
        </div>
      </article>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison: return true if props are equal (no re-render)
    return (
      prevProps.result?.mentorId === nextProps.result?.mentorId &&
      prevProps.result?.score === nextProps.result?.score &&
      prevProps.onBookNearestSession === nextProps.onBookNearestSession &&
      prevProps.onFindSimilar === nextProps.onFindSimilar
    );
  },
);

MentorSearchCard.displayName = "MentorSearchCard";

export default MentorSearchCard;
