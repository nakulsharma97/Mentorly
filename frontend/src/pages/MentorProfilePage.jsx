import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import client from "../api/client";
import { getErrorFeedback, getInfoFeedback } from "../utils/comingSoon";
import { trackAnalyticsEvent } from "../utils/analyticsEvents";
import BookingFlowPage from "./BookingFlowPage";
import MentorProfileHeader from "../components/mentor/MentorProfileHeader";
import MentorSessionList from "../components/mentor/MentorSessionList";
import MentorReviewSection from "../components/mentor/MentorReviewSection";
import MentorCertifications from "../components/mentor/MentorCertifications";
import {
  SkeletonLine,
  SkeletonSessionList,
} from "../components/SkeletonLoaders";
import "./MentorProfilePage.css";

const dateInputFromDateTime = (value) => {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
};

const parseSkillChips = (rawSkills) => {
  const value = String(rawSkills || "").trim();
  if (!value) {
    return [];
  }

  if (value.startsWith("[") && value.includes('"name"')) {
    const matches = [...value.matchAll(/"name"\s*:\s*"([^"]+)"/g)]
      .map((match) => String(match[1] || "").trim())
      .filter(Boolean);
    if (matches.length) {
      return [...new Set(matches)].slice(0, 8);
    }
  }

  return [
    ...new Set(
      value
        .split(/[\n,;|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ].slice(0, 8);
};

export default function MentorProfilePage({ isLoggedIn, onRequireLogin }) {
  const { mentorId } = useParams();
  const navigate = useNavigate();
  const [mentor, setMentor] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [summary, setSummary] = useState({ averageRating: 0, totalReviews: 0 });
  const [eligibleBookings, setEligibleBookings] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bookingSessionId, setBookingSessionId] = useState(null);
  const [reviewMessage, setReviewMessage] = useState("");
  const [reviewForm, setReviewForm] = useState({
    bookingId: "",
    rating: "5",
    comment: "",
  });

  const skillChips = useMemo(
    () => parseSkillChips(mentor?.skills),
    [mentor?.skills],
  );
  const trustSnapshot = useMemo(() => {
    const rating = Number(summary.averageRating || 0);
    const totalReviews = Number(summary.totalReviews || 0);
    const sessionsOffered =
      Number(mentor?.upcomingSessions || 0) + Number(sessions.length || 0);
    const responseMinutes =
      totalReviews >= 10 ? 35 : totalReviews >= 4 ? 55 : 85;
    const reliabilityScore = Math.min(
      99,
      Math.max(72, Math.round(rating * 18 + Math.min(15, totalReviews))),
    );
    return {
      responseLabel: `${responseMinutes} min avg response`,
      reliabilityScore,
      sessionsOffered,
    };
  }, [
    mentor?.upcomingSessions,
    sessions.length,
    summary.averageRating,
    summary.totalReviews,
  ]);
  const loadMentorData = async () => {
    setLoading(true);
    setError("");

    try {
      const [profileResult, sessionsResult, reviewsResult, certificationsResult] =
        await Promise.allSettled([
          client.get(`/api/v1/users/mentors/${mentorId}`),
          client.get(`/api/v1/sessions/mentor/${mentorId}`),
          client.get(`/api/v1/reviews/mentor/${mentorId}`),
          client.get(`/api/mentor/certifications/${mentorId}`),
        ]);

      if (profileResult.status !== "fulfilled") {
        throw profileResult.reason;
      }

      setMentor(profileResult.value?.data?.data || null);
      setSessions(
        sessionsResult.status === "fulfilled"
          ? sessionsResult.value?.data?.data || []
          : [],
      );
      setCertifications(
        certificationsResult.status === "fulfilled"
          ? certificationsResult.value?.data?.data || []
          : [],
      );

      const reviewData =
        reviewsResult.status === "fulfilled"
          ? reviewsResult.value?.data?.data || {}
          : {};
      setSummary({
        averageRating: Number(reviewData.averageRating || 0),
        totalReviews: Number(reviewData.totalReviews || 0),
      });
      setReviews(reviewData.reviews || []);

      if (isLoggedIn) {
        try {
          const eligibleRes = await client.get(
            `/api/v1/reviews/eligible/mentor/${mentorId}`,
          );
          const nextEligible = eligibleRes.data.data || [];
          setEligibleBookings(nextEligible);
          setReviewForm((prev) => ({
            ...prev,
            bookingId:
              prev.bookingId ||
              (nextEligible[0] ? String(nextEligible[0].bookingId) : ""),
          }));
        } catch {
          setEligibleBookings([]);
        }
      } else {
        setEligibleBookings([]);
      }
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      setError(
        backendError || getErrorFeedback("mentorProfileLoadFailed").message,
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMentorData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorId, isLoggedIn]);

  const filteredSessions = useMemo(() => {
    if (!selectedDate) {
      return sessions;
    }
    return sessions.filter(
      (session) => dateInputFromDateTime(session.startTime) === selectedDate,
    );
  }, [sessions, selectedDate]);

  const handleReviewSubmit = async (event) => {
    event.preventDefault();
    setReviewMessage("");

    if (!isLoggedIn) {
      setReviewMessage(getInfoFeedback("reviewLoginRequired").message);
      if (onRequireLogin) {
        onRequireLogin();
      }
      return;
    }

    if (!reviewForm.bookingId) {
      setReviewMessage(getInfoFeedback("reviewChooseCompletedBooking").message);
      return;
    }

    try {
      await client.post("/api/v1/reviews", {
        bookingId: Number(reviewForm.bookingId),
        mentorId: Number(mentorId),
        rating: Number(reviewForm.rating),
        comment: reviewForm.comment,
      });
      setReviewMessage(getInfoFeedback("reviewThanks").message);
      trackAnalyticsEvent("mentor_review_submitted", {
        mentorId,
        bookingId: Number(reviewForm.bookingId),
        rating: Number(reviewForm.rating),
      });
      setReviewForm((prev) => ({ ...prev, comment: "" }));
      await loadMentorData();
    } catch (err) {
      const backendError = err?.response?.data?.data?.error;
      trackAnalyticsEvent("mentor_review_submit_failed", {
        mentorId,
        bookingId: Number(reviewForm.bookingId),
        rating: Number(reviewForm.rating),
        hasBackendMessage: Boolean(backendError),
      });
      setReviewMessage(
        backendError || getErrorFeedback("reviewSubmitFailed").message,
      );
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
    <div className="mentor-profile-page" style={{ position: "relative" }}>
      {bookingSessionId && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 100,
            background: "#fff",
            overflowY: "auto",
          }}
        >
          <BookingFlowPage
            sessionId={bookingSessionId}
            onBookingComplete={() => navigate("/sessions")}
            onCancel={() => setBookingSessionId(null)}
          />
        </div>
      )}

      <MentorProfileHeader
        mentor={mentor}
        summary={summary}
        trustSnapshot={trustSnapshot}
        skillChips={skillChips}
      />

      <MentorCertifications certifications={certifications} />

      <div className="mentor-content-grid">
        <MentorSessionList
          sessions={sessions}
          filteredSessions={filteredSessions}
          selectedDate={selectedDate}
          onSelectDate={(dateTime) =>
            setSelectedDate(dateInputFromDateTime(dateTime))
          }
          onClearDate={() => setSelectedDate("")}
          onBookSession={setBookingSessionId}
          isLoggedIn={isLoggedIn}
          onRequireLogin={onRequireLogin}
          mentorId={mentorId}
        />

        <MentorReviewSection
          reviews={reviews}
          summary={summary}
          isLoggedIn={isLoggedIn}
          reviewForm={reviewForm}
          onReviewFormChange={(field, value) =>
            setReviewForm((prev) => ({ ...prev, [field]: value }))
          }
          onSubmit={handleReviewSubmit}
          eligibleBookings={eligibleBookings}
          reviewMessage={reviewMessage}
        />
      </div>
    </div>
  );
}
