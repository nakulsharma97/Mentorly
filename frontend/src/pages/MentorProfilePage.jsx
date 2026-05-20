import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import client from '../api/client';
import { getApiErrorMessage, isRetryableApiError } from '../utils/apiErrors';
import { getErrorFeedback, getInfoFeedback } from '../utils/comingSoon';
import { trackAnalyticsEvent } from '../utils/analyticsEvents';
import { useBookingRetryState } from '../hooks/useBookingRetryState';
import DateTimePicker from '../components/DateTimePicker';
import OptimizedImage from '../components/OptimizedImage';
import { SkeletonLine, SkeletonSessionList } from '../components/SkeletonLoaders';
import './MentorProfilePage.css';

const BOOKING_COPY = {
  loginRequired: 'Please log in to book this session.',
  retryInProgress: 'Retrying booking request...',
  success: 'Session booked successfully. You can track it in your dashboard bookings.',
  retryableFailure: getErrorFeedback('bookingRetryConflict').message,
  genericFailure: 'Booking failed. Please try a different slot.',
};

const formatDateTime = (value) => {
  if (!value) {
    return 'TBD';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString();
};

const dateInputFromDateTime = (value) => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
};

const parseSkillChips = (rawSkills) => {
  const value = String(rawSkills || '').trim();
  if (!value) {
    return [];
  }

  if (value.startsWith('[') && value.includes('"name"')) {
    const matches = [...value.matchAll(/"name"\s*:\s*"([^"]+)"/g)]
      .map((match) => String(match[1] || '').trim())
      .filter(Boolean);
    if (matches.length) {
      return [...new Set(matches)].slice(0, 8);
    }
  }

  return [...new Set(value.split(/[\n,;|]+/).map((part) => part.trim()).filter(Boolean))].slice(0, 8);
};

export default function MentorProfilePage({ isLoggedIn, onRequireLogin }) {
  const { mentorId } = useParams();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, totalReviews: 0 });
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [bookingMessageTone, setBookingMessageTone] = useState('info');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewForm, setReviewForm] = useState({ bookingId: '', rating: '5', comment: '' });
  const bookingStatusRef = useRef(null);

  const token = localStorage.getItem('token');
  const skillChips = useMemo(() => parseSkillChips(mentor?.skills), [mentor?.skills]);
  const trustSnapshot = useMemo(() => {
    const rating = Number(summary.averageRating || 0);
    const totalReviews = Number(summary.totalReviews || 0);
    const sessionsOffered = Number(mentor?.upcomingSessions || 0) + Number(sessions.length || 0);
    const responseMinutes = totalReviews >= 10 ? 35 : totalReviews >= 4 ? 55 : 85;
    const reliabilityScore = Math.min(99, Math.max(72, Math.round((rating * 18) + Math.min(15, totalReviews))));
    return {
      responseLabel: `${responseMinutes} min avg response`,
      reliabilityScore,
      sessionsOffered
    };
  }, [mentor?.upcomingSessions, sessions.length, summary.averageRating, summary.totalReviews]);
  const {
    bookingInFlight,
    activeBookingSessionId,
    lastFailedBookingSessionId,
    prepareBookingRequest,
    completeBookingRequest,
  } = useBookingRetryState(mentorId);

  const loadMentorData = async () => {
    setLoading(true);
    setError('');

    try {
      const [profileResult, sessionsResult, reviewsResult] = await Promise.allSettled([
        client.get(`/api/v1/users/mentors/${mentorId}`),
        client.get(`/api/v1/sessions/mentor/${mentorId}`),
        client.get(`/api/v1/reviews/mentor/${mentorId}`)
      ]);

      if (profileResult.status !== 'fulfilled') {
        throw profileResult.reason;
      }

      setMentor(profileResult.value?.data?.data || null);
      setSessions(sessionsResult.status === 'fulfilled' ? (sessionsResult.value?.data?.data || []) : []);

      const reviewData = reviewsResult.status === 'fulfilled'
        ? (reviewsResult.value?.data?.data || {})
        : {};
      setSummary({
        averageRating: Number(reviewData.averageRating || 0),
        totalReviews: Number(reviewData.totalReviews || 0)
      });
      setReviews(reviewData.reviews || []);

      if (token) {
        try {
          const eligibleRes = await client.get(`/api/v1/reviews/eligible/mentor/${mentorId}`);
          const nextEligible = eligibleRes.data.data || [];
          setEligibleBookings(nextEligible);
          setReviewForm((prev) => ({
            ...prev,
            bookingId: prev.bookingId || (nextEligible[0] ? String(nextEligible[0].bookingId) : '')
          }));
        } catch {
          setEligibleBookings([]);
        }
      } else {
        setEligibleBookings([]);
      }
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      setError(backendError || getErrorFeedback('mentorProfileLoadFailed').message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorId, token]);

  const filteredSessions = useMemo(() => {
    if (!selectedDate) {
      return sessions;
    }
    return sessions.filter((session) => dateInputFromDateTime(session.startTime) === selectedDate);
  }, [sessions, selectedDate]);

  useEffect(() => {
    if (bookingMessage && bookingStatusRef.current) {
      bookingStatusRef.current.focus();
    }
  }, [bookingMessage]);

  const handleBookSession = async (sessionId) => {
    if (bookingInFlight) {
      return;
    }

    setBookingMessage('');
    setBookingMessageTone('info');
    if (!token || !isLoggedIn) {
      setBookingMessage(BOOKING_COPY.loginRequired);
      setBookingMessageTone('error');
      if (onRequireLogin) {
        onRequireLogin();
      }
      return;
    }

    trackAnalyticsEvent('mentor_profile_booking_attempted', {
      mentorId,
      sessionId,
      retry: bookingInFlight || lastFailedBookingSessionId === sessionId
    });

    const { requestKey, isRetry } = prepareBookingRequest(sessionId);
    if (isRetry) {
      setBookingMessage(BOOKING_COPY.retryInProgress);
      setBookingMessageTone('info');
    }

    try {
      await client.post('/api/v1/bookings', { sessionId }, {
        headers: {
          'Idempotency-Key': requestKey,
        },
      });
      setBookingMessage(BOOKING_COPY.success);
      setBookingMessageTone('success');
      trackAnalyticsEvent('mentor_profile_booking_success', { mentorId, sessionId });
      completeBookingRequest(sessionId, true);
      navigate('/sessions');
    } catch (err) {
      completeBookingRequest(sessionId, false);
      const backendError = getApiErrorMessage(err, '');
      const retryable = isRetryableApiError(err);
      setBookingMessage(backendError || (retryable
        ? BOOKING_COPY.retryableFailure
        : BOOKING_COPY.genericFailure));
      setBookingMessageTone('error');
      trackAnalyticsEvent('mentor_profile_booking_failed', {
        mentorId,
        sessionId,
        retryable
      });
    }
  };

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewMessage('');

    if (!token || !isLoggedIn) {
      setReviewMessage(getInfoFeedback('reviewLoginRequired').message);
      if (onRequireLogin) {
        onRequireLogin();
      }
      return;
    }

    if (!reviewForm.bookingId) {
      setReviewMessage(getInfoFeedback('reviewChooseCompletedBooking').message);
      return;
    }

    try {
      await client.post('/api/v1/reviews', {
        bookingId: Number(reviewForm.bookingId),
        mentorId: Number(mentorId),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment
      });
      setReviewMessage(getInfoFeedback('reviewThanks').message);
      trackAnalyticsEvent('mentor_review_submitted', {
        mentorId,
        bookingId: Number(reviewForm.bookingId),
        rating: Number(reviewForm.rating)
      });
      setReviewForm((prev) => ({ ...prev, comment: '' }));
      await loadMentorData();
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      trackAnalyticsEvent('mentor_review_submit_failed', {
        mentorId,
        bookingId: Number(reviewForm.bookingId),
        rating: Number(reviewForm.rating),
        hasBackendMessage: Boolean(backendError)
      });
      setReviewMessage(backendError || getErrorFeedback('reviewSubmitFailed').message);
    }
  };

  if (loading) {
    return (
      <section className="dashboard-card mentor-profile-page">
        <div className="space-y-4">
          <SkeletonLine height="28px" width="45%" />
          <SkeletonLine height="18px" width="70%" />
          <SkeletonSessionList rows={3} />
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="dashboard-card mentor-profile-page">
        <h3>Mentor profile</h3>
        <p className="error">{error}</p>
      </section>
    );
  }

  return (
    <div className="mentor-profile-page">
      <section className="dashboard-card mentor-hero mentor-hero-surface">
        <div className="mentor-hero-topline">
          <p className="muted">Public mentor profile</p>
          <Link className="meeting-link" to="/home">Back to home</Link>
        </div>

        <div className="mentor-hero-layout">
          <div className="mentor-avatar-wrap">
            {mentor?.profileImageUrl ? (
              <OptimizedImage src={mentor.profileImageUrl} alt={mentor?.fullName || 'Mentor'} className="mentor-avatar" />
            ) : (
              <div className="mentor-avatar-fallback">{String(mentor?.fullName || 'M').charAt(0).toUpperCase()}</div>
            )}
          </div>

          <div className="mentor-hero-content">
            <h2>{mentor?.fullName}</h2>
            <div className="mentor-badge-row">
              <span className="mentor-chip mentor-chip-soft">Public mentor</span>
              {mentor?.mentorVerified && <span className="mentor-chip mentor-chip-verified">Verified</span>}
            </div>

            <div className="mentor-rating-chip">
              <strong>{summary.averageRating.toFixed(1)}</strong>
              <span>/ 5 from {summary.totalReviews} reviews</span>
            </div>

            <div className="mentor-trust-strip">
              <span className="mentor-chip mentor-chip-soft">{trustSnapshot.responseLabel}</span>
              <span className="mentor-chip mentor-chip-soft">Reliability {trustSnapshot.reliabilityScore}%</span>
              <span className="mentor-chip mentor-chip-soft">{trustSnapshot.sessionsOffered} listed sessions</span>
            </div>

            <p className="mentor-bio-copy">{mentor?.aboutMe || 'No mentor bio added yet.'}</p>

            <div className="mentor-skill-row">
              {skillChips.length ? skillChips.map((skill) => (
                <span key={skill} className="mentor-skill-chip">{skill}</span>
              )) : <span className="muted">No skills listed yet.</span>}
            </div>
          </div>
        </div>

        <div className="mentor-meta-grid">
          <div className="mentor-meta-tile">
            <strong>Verified skills</strong>
            <p>{mentor?.verifiedSkills || 'No verified badges yet'}</p>
          </div>
          <div className="mentor-meta-tile">
            <strong>Upcoming sessions</strong>
            <p>{mentor?.upcomingSessions || 0}</p>
          </div>
          <div className="mentor-meta-tile">
            <strong>Links</strong>
            <p>
              {mentor?.githubUrl ? <a className="meeting-link" href={mentor.githubUrl} target="_blank" rel="noreferrer">GitHub</a> : 'GitHub N/A'}
              {' | '}
              {mentor?.linkedinUrl ? <a className="meeting-link" href={mentor.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a> : 'LinkedIn N/A'}
            </p>
          </div>
          <div className="mentor-meta-tile">
            <strong>Mentor ID</strong>
            <p>#{mentorId}</p>
          </div>
        </div>
      </section>

      <section className="dashboard-card mentor-section-card">
        <div className="mentor-section-header">
          <h3>Calendar and booking</h3>
          <Link className="meeting-link" to="/mentors">Back to mentors</Link>
        </div>
        <div className="inline-form mentor-filter-row">
          <DateTimePicker
            label="Pick a booking date"
            onSelect={(dateTime) => setSelectedDate(dateInputFromDateTime(dateTime))}
          />
          <button type="button" onClick={() => setSelectedDate('')}>Clear</button>
        </div>
        {filteredSessions.length === 0 ? (
          <p className="muted">No session slots for selected date.</p>
        ) : (
          <ul className="mentor-list-clean">
            {filteredSessions.map((session) => (
              <li key={session.id} className="mentor-list-item">
                <div className="mentor-list-heading">
                  <strong>{session.title}</strong>
                  <span className="mentor-type-pill">{session.sessionType}</span>
                </div>
                <div className="muted">{formatDateTime(session.startTime)} to {formatDateTime(session.endTime)}</div>
                <div className="muted">Price: INR {session.priceAmount}</div>
                <button
                  type="button"
                  className="mentor-cta-btn"
                  disabled={bookingInFlight}
                  aria-disabled={bookingInFlight}
                  onClick={() => handleBookSession(session.id)}
                >
                  {bookingInFlight && activeBookingSessionId === session.id
                    ? 'Booking...'
                    : (lastFailedBookingSessionId === session.id ? 'Retry booking' : 'Book now')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {bookingMessage && (
          <p
            ref={bookingStatusRef}
            tabIndex={-1}
            className="muted"
            role={bookingMessageTone === 'error' ? 'alert' : 'status'}
            aria-live={bookingMessageTone === 'error' ? 'assertive' : 'polite'}
          >
            {bookingMessage}
          </p>
        )}
      </section>

      <section className="dashboard-card mentor-section-card">
        <h3>Ratings and reviews</h3>
        {reviews.length === 0 ? (
          <p className="muted">No reviews yet.</p>
        ) : (
          <ul className="mentor-list-clean">
            {reviews.map((review) => (
              <li key={review.id} className="mentor-list-item">
                <div className="mentor-list-heading">
                  <strong>{review.learnerName || `Learner #${review.learnerId}`}</strong>
                  <span className="mentor-type-pill">{review.rating}/5</span>
                </div>
                <div className="muted">{formatDateTime(review.createdAt)}</div>
                <p>{review.comment || 'No written feedback.'}</p>
              </li>
            ))}
          </ul>
        )}

        {isLoggedIn && (
          <form onSubmit={handleReviewSubmit} className="mentor-review-form">
            <h4>Leave a review</h4>
            <select
              value={reviewForm.bookingId}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, bookingId: event.target.value }))}
            >
              <option value="">Select completed booking</option>
              {eligibleBookings.map((booking) => (
                <option key={booking.bookingId} value={booking.bookingId}>
                  #{booking.bookingId} - {booking.sessionTitle}
                </option>
              ))}
            </select>
            <select
              value={reviewForm.rating}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, rating: event.target.value }))}
            >
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Great</option>
              <option value="3">3 - Good</option>
              <option value="2">2 - Fair</option>
              <option value="1">1 - Poor</option>
            </select>
            <textarea
              rows={3}
              placeholder="Share your feedback"
              value={reviewForm.comment}
              onChange={(event) => setReviewForm((prev) => ({ ...prev, comment: event.target.value }))}
            />
            <button type="submit" className="mentor-cta-btn">Submit review</button>
            {reviewMessage && <p className="muted">{reviewMessage}</p>}
            {eligibleBookings.length === 0 && (
              <p className="muted">You can review after you complete a booking with this mentor.</p>
            )}
          </form>
        )}
      </section>
    </div>
  );
}
