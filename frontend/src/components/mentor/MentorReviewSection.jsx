const starSymbols = ["★", "★", "★", "★", "★"];

const renderStars = (rating) =>
  starSymbols.map((symbol, index) => (
    <span key={index} className={`star ${index < rating ? "" : "empty"}`}>
      {symbol}
    </span>
  ));

export default function MentorReviewSection({
  reviews,
  summary,
  isLoggedIn,
  reviewForm,
  onReviewFormChange,
  onSubmit,
  eligibleBookings,
  reviewMessage,
}) {
  return (
    <section className="dashboard-card mentor-section-card">
      <div className="mentor-section-header">
        <div>
          <h3>Ratings and reviews</h3>
          <p className="mentor-section-copy">
            Expert feedback from learners who booked sessions.
          </p>
        </div>
        <span className="mentor-badge mentor-badge-alt">
          {summary.totalReviews} reviews
        </span>
      </div>

      {reviews.length === 0 ? (
        <div className="mentor-empty-state">
          <p className="mentor-empty-title">No reviews yet</p>
          <p className="mentor-empty-text">
            Be the first learner to share feedback after a completed session.
          </p>
        </div>
      ) : (
        <ul className="mentor-review-list">
          {reviews.map((review) => (
            <li key={review.id} className="mentor-list-item mentor-review-card">
              <div className="mentor-review-meta">
                <div>
                  <strong>
                    {review.learnerName || `Learner #${review.learnerId}`}
                  </strong>
                  <div className="mentor-review-date">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="mentor-review-score">
                  <span className="mentor-review-stars">
                    {renderStars(Number(review.rating || 0))}
                  </span>
                  <strong>{review.rating}/5</strong>
                </div>
              </div>
              <p>{review.comment || "No written feedback provided."}</p>
            </li>
          ))}
        </ul>
      )}

      {isLoggedIn && (
        <form onSubmit={onSubmit} className="mentor-review-form">
          <h4>Leave a review</h4>
          <select
            value={reviewForm.bookingId}
            onChange={(event) =>
              onReviewFormChange("bookingId", event.target.value)
            }
          >
            <option value="">Select completed booking</option>
            {eligibleBookings.map((booking) => (
              <option key={booking.bookingId} value={booking.bookingId}>
                #{booking.bookingId} — {booking.sessionTitle}
              </option>
            ))}
          </select>
          <select
            value={reviewForm.rating}
            onChange={(event) =>
              onReviewFormChange("rating", event.target.value)
            }
          >
            <option value="5">5 - Excellent</option>
            <option value="4">4 - Great</option>
            <option value="3">3 - Good</option>
            <option value="2">2 - Fair</option>
            <option value="1">1 - Needs improvement</option>
          </select>
          <textarea
            rows={4}
            placeholder="Share your feedback from the session"
            value={reviewForm.comment}
            onChange={(event) =>
              onReviewFormChange("comment", event.target.value)
            }
          />
          <button type="submit" className="mentor-cta-btn">
            Submit review
          </button>
          {reviewMessage && <p className="muted">{reviewMessage}</p>}
          {eligibleBookings.length === 0 && (
            <p className="muted">
              You can leave a review after you complete a booking with this
              mentor.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
