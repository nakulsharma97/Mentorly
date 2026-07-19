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
    isSaved = false,
    onSaveToggle,
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
      <article className={"mentor-result-card" + (isSaved ? " is-saved" : "")}>
        <div className="mentor-result-card-head">
          <div>
            <p className="mentor-result-label">Mentor</p>
            <h4>{result.mentorName}</h4>
          </div>
          <div className="mentor-result-card__actions-row">
            {onSaveToggle && (
              <button
                type="button"
                className={"mentor-result-card__save-btn" + (isSaved ? " is-saved" : "")}
                onClick={(e) => { e.stopPropagation(); onSaveToggle(result.mentorId); }}
                aria-label={isSaved ? "Remove from saved" : "Save mentor"}
                title={isSaved ? "Saved" : "Save mentor"}
              >
                <span className="material-symbols-outlined">{isSaved ? "bookmark" : "bookmark_border"}</span>
              </button>
            )}
            <div className="mentor-result-score">
              <strong>{result.score}</strong>
              <span>score</span>
            </div>
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
            href={"/mentors/" + result.mentorId}
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
    return (
      prevProps.result?.mentorId === nextProps.result?.mentorId &&
      prevProps.result?.score === nextProps.result?.score &&
      prevProps.isSaved === nextProps.isSaved &&
      prevProps.onSaveToggle === nextProps.onSaveToggle &&
      prevProps.onBookNearestSession === nextProps.onBookNearestSession &&
      prevProps.onFindSimilar === nextProps.onFindSimilar
    );
  },
);

MentorSearchCard.displayName = "MentorSearchCard";

export default MentorSearchCard;
