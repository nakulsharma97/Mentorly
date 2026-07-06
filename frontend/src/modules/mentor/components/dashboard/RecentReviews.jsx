import SectionCard, { EmptyState } from "../../../common/dashboard/SectionCard";
import Icon from "../../../common/dashboard/Icon";
import { initials, relativeDate } from "../../../common/dashboard/dashboardUtils";

function Stars({ rating = 0 }) {
  return (
    <span className="md-stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon key={n} name="star" className={n <= Number(rating) ? "is-on" : "is-off"} />
      ))}
    </span>
  );
}

/** Recent reviews: avatar, rating, comment, course and date. */
export default function RecentReviews({ reviews = [] }) {
  return (
    <SectionCard
      title="Recent Reviews"
      icon="star_rate"
      action="All reviews"
      actionTo="/mentor/reviews"
    >
      {reviews.length === 0 ? (
        <EmptyState
          icon="reviews"
          title="No reviews yet"
          description="Complete sessions to earn reviews from your learners."
        />
      ) : (
        <div className="md-rows">
          {reviews.slice(0, 3).map((r) => (
            <div key={r.id} className="md-review">
              <div className="md-review__head">
                <span className="md-avatar md-avatar--sm">
                  {initials(r?.learner?.fullName)}
                </span>
                <div>
                  <p className="md-review__name">{r?.learner?.fullName || "Learner"}</p>
                  <p className="md-review__date">{relativeDate(r?.createdAt)}</p>
                </div>
                <Stars rating={r?.rating} />
              </div>
              {r?.comment && <p className="md-review__text">“{r.comment}”</p>}
              {(r?.session?.skill?.name || r?.session?.title) && (
                <span className="md-review__course">
                  <Icon name="menu_book" />
                  {r?.session?.skill?.name || r?.session?.title}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
