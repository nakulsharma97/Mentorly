import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import client from "../api/client";
import { roleRoot } from "../modules/common/routeUtils";
import { useDocumentTitle } from "./learner-utils";
import "./ShareReviewPage.css";

const MIN_COMMENT = 10;
const MAX_COMMENT = 1000;
const MAX_TITLE = 120;

const STATUS_META = {
  PENDING: { label: "Pending review", tone: "pending" },
  APPROVED: { label: "Published", tone: "published" },
  REJECTED: { label: "Not published", tone: "rejected" },
};

/** Pull a human-readable message out of an ApiResponse error body. */
function extractError(err, fallback) {
  const data = err?.response?.data;
  return (
    data?.data?.error ||
    data?.message ||
    (typeof data === "string" ? data : "") ||
    err?.message ||
    fallback
  );
}

export default function ShareReviewPage({ profile, notify }) {
  useDocumentTitle("Share your review");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [existing, setExisting] = useState(null);
  const [view, setView] = useState("form"); // "form" | "review" | "submitted"
  const [editing, setEditing] = useState(false);

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const commentRef = useRef(null);

  const loadMine = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await client.get("/api/v1/site-reviews/me");
      const review = res?.data?.data ?? null;
      setExisting(review);
      setView(review ? "review" : "form");
    } catch (err) {
      setLoadError(
        extractError(err, "We could not load your review. Please try again."),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  const trimmedComment = comment.trim();
  const commentLength = trimmedComment.length;
  const titleTooLong = title.trim().length > MAX_TITLE;
  const commentTooShort = commentLength > 0 && commentLength < MIN_COMMENT;
  const isValid =
    rating >= 1 &&
    rating <= 5 &&
    commentLength >= MIN_COMMENT &&
    commentLength <= MAX_COMMENT &&
    !titleTooLong;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    setFormError("");
    const body = {
      rating,
      title: title.trim() || null,
      comment: trimmedComment,
    };
    try {
      const res =
        existing && editing
          ? await client.put("/api/v1/site-reviews/me", body)
          : await client.post("/api/v1/site-reviews", body);
      const saved = res?.data?.data ?? null;
      setExisting(saved);
      setEditing(false);
      setView("submitted");
      notify?.({
        type: "success",
        title: editing ? "Review updated" : "Review submitted",
        message: "Your review is now waiting for approval.",
      });
    } catch (err) {
      // 409 / 400 / 429 and anything else — always inline, never toast-only.
      setFormError(
        extractError(
          err,
          "Something went wrong while saving your review. Please try again.",
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = () => {
    if (!existing) return;
    setRating(existing.rating || 0);
    setTitle(existing.title || "");
    setComment(existing.comment || "");
    setFormError("");
    setEditing(true);
    setView("form");
    // Focus the comment box so keyboard users land in the form.
    window.setTimeout(() => commentRef.current?.focus(), 0);
  };

  const handleDelete = async () => {
    if (deleting) return;
    if (
      !window.confirm(
        "Delete your review? This cannot be undone and it will be removed from the landing page.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setFormError("");
    try {
      await client.delete("/api/v1/site-reviews/me");
      setExisting(null);
      setEditing(false);
      setRating(0);
      setTitle("");
      setComment("");
      setView("form");
      notify?.({
        type: "success",
        title: "Review deleted",
        message: "Your review has been removed.",
      });
    } catch (err) {
      setFormError(
        extractError(err, "Could not delete your review. Please try again."),
      );
    } finally {
      setDeleting(false);
    }
  };

  const cancelEdit = () => {
    setEditing(false);
    setFormError("");
    setView(existing ? "review" : "form");
  };

  const dashboardPath = roleRoot(profile?.role);

  if (loading) {
    return (
      <main className="sr-page" aria-busy="true">
        <div className="sr-card sr-card--loading">
          <div className="sr-spinner" aria-hidden="true" />
          <p>Loading your review…</p>
        </div>
      </main>
    );
  }

  if (loadError && !existing && view !== "submitted") {
    return (
      <main className="sr-page">
        <div className="sr-card sr-card--error" role="alert">
          <span className="material-symbols-outlined" aria-hidden="true">
            error_outline
          </span>
          <p>{loadError}</p>
          <button
            type="button"
            className="sr-btn sr-btn--primary"
            onClick={loadMine}
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="sr-page">
      <header className="sr-hero">
        <span className="sr-hero__badge">
          <span className="material-symbols-outlined" aria-hidden="true">
            rate_review
          </span>
          Share your review
        </span>
        <h1 className="sr-hero__title">Share your experience with Mentorly</h1>
        <p className="sr-hero__subtitle">
          Your feedback helps other learners decide to join. Reviews are read
          by our team before they appear on the landing page — one review per
          account, and you can edit or delete yours any time.
        </p>
      </header>

      {view === "submitted" ? (
        <section className="sr-card sr-success" aria-live="polite">
          <span className="material-symbols-outlined sr-success__icon" aria-hidden="true">
            check_circle
          </span>
          <h2 className="sr-success__title">
            Thanks! Your review will appear on the landing page after approval
          </h2>
          <p className="sr-success__text">
            We will notify you once it is published. In the meantime you can
            keep exploring Mentorly.
          </p>
          <div className="sr-success__actions">
            <Link className="sr-btn sr-btn--primary" to={dashboardPath}>
              Go to your dashboard
            </Link>
            {existing && (
              <button
                type="button"
                className="sr-btn sr-btn--secondary"
                onClick={() => setView("review")}
              >
                View my review
              </button>
            )}
          </div>
        </section>
      ) : view === "review" && existing ? (
        <section className="sr-card">
          <div className="sr-review__head">
            <span
              className={`sr-badge sr-badge--${STATUS_META[existing.status]?.tone || "pending"}`}
            >
              {STATUS_META[existing.status]?.label || "Pending review"}
            </span>
            <span className="sr-review__date">
              Submitted{" "}
              {existing.createdAt
                ? new Date(existing.createdAt).toLocaleDateString()
                : ""}
            </span>
          </div>

          <div
            className="sr-stars sr-stars--static"
            role="img"
            aria-label={`Rated ${existing.rating} out of 5`}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <span
                key={n}
                className={`material-symbols-outlined sr-star${
                  n <= existing.rating ? " sr-star--on" : ""
                }`}
                aria-hidden="true"
              >
                star
              </span>
            ))}
          </div>

          {existing.title && <h2 className="sr-review__title">{existing.title}</h2>}
          <p className="sr-review__comment">{existing.comment}</p>

          {existing.status === "REJECTED" && (
            <div className="sr-admin-note" role="note">
              <span className="material-symbols-outlined" aria-hidden="true">
                info
              </span>
              <div>
                <strong>Why it is not published</strong>
                <p>
                  {existing.adminNote ||
                    "This review was not approved by our moderators. You can edit it and submit again."}
                </p>
              </div>
            </div>
          )}

          {formError && (
            <p className="sr-error" role="alert">
              {formError}
            </p>
          )}

          <div className="sr-review__actions">
            <button
              type="button"
              className="sr-btn sr-btn--secondary"
              onClick={startEdit}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                edit
              </span>
              Edit
            </button>
            <button
              type="button"
              className="sr-btn sr-btn--danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              <span className="material-symbols-outlined" aria-hidden="true">
                delete
              </span>
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </section>
      ) : (
        <section className="sr-card">
          {editing && (
            <p className="sr-edit-warning" role="note">
              <span className="material-symbols-outlined" aria-hidden="true">
                info
              </span>
              Editing your review sends it back through moderation — it will
              return to “Pending review” until approved again.
            </p>
          )}

          <form className="sr-form" onSubmit={handleSubmit} noValidate>
            <fieldset className="sr-field sr-field--rating">
              <legend className="sr-label">
                Your rating
                <span className="sr-required" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="sr-stars sr-stars--input" role="radiogroup" aria-label="Rating, 1 to 5 stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label
                    key={n}
                    className={`sr-star-label${rating >= n ? " sr-star-label--hover" : ""}`}
                  >
                    <input
                      type="radio"
                      name="site-review-rating"
                      value={n}
                      checked={rating === n}
                      onChange={() => setRating(n)}
                      aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      className="sr-radio"
                    />
                    <span
                      className={`material-symbols-outlined sr-star${
                        n <= rating ? " sr-star--on" : ""
                      }`}
                      aria-hidden="true"
                    >
                      star
                    </span>
                  </label>
                ))}
                <span className="sr-rating-text" aria-live="polite">
                  {rating > 0 ? `${rating}/5` : ""}
                </span>
              </div>
            </fieldset>

            <div className="sr-field">
              <label className="sr-label" htmlFor="sr-title">
                Title <span className="sr-optional">(optional)</span>
              </label>
              <input
                id="sr-title"
                className="sr-input"
                type="text"
                maxLength={MAX_TITLE}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Sum it up in a few words"
                aria-invalid={titleTooLong}
              />
            </div>

            <div className="sr-field">
              <label className="sr-label" htmlFor="sr-comment">
                Your review
                <span className="sr-required" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id="sr-comment"
                ref={commentRef}
                className="sr-textarea"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={6}
                placeholder={`What did you like? What could be better? (at least ${MIN_COMMENT} characters)`}
                aria-describedby="sr-comment-help"
                aria-invalid={commentTooShort || commentLength > MAX_COMMENT}
              />
              <div className="sr-counter" id="sr-comment-help">
                <span
                  className={
                    commentTooShort
                      ? "sr-counter__hint sr-counter__hint--warn"
                      : "sr-counter__hint"
                  }
                >
                  {commentTooShort
                    ? `At least ${MIN_COMMENT} characters`
                    : "Looks good"}
                </span>
                <span
                  className={`sr-counter__count${
                    commentLength > MAX_COMMENT ? " sr-counter__count--over" : ""
                  }`}
                >
                  {commentLength}/{MAX_COMMENT}
                </span>
              </div>
            </div>

            {formError && (
              <p className="sr-error" role="alert">
                {formError}
              </p>
            )}

            <div className="sr-form__actions">
              <button
                type="submit"
                className="sr-btn sr-btn--primary"
                disabled={!isValid || submitting}
              >
                {submitting
                  ? "Submitting…"
                  : editing
                    ? "Save changes"
                    : "Submit review"}
              </button>
              {editing && (
                <button
                  type="button"
                  className="sr-btn sr-btn--ghost"
                  onClick={cancelEdit}
                  disabled={submitting}
                >
                  Cancel
                </button>
              )}
            </div>
            {!isValid && !formError && (
              <p className="sr-hint">
                Pick a star rating and write between {MIN_COMMENT} and{" "}
                {MAX_COMMENT} characters to submit.
              </p>
            )}
          </form>
        </section>
      )}
    </main>
  );
}
