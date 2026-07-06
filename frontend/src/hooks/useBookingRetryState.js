import { useCallback, useRef, useState } from "react";
import { createIdempotencyKey } from "../api/client";

export function useBookingRetryState(mentorId) {
  const [bookingInFlight, setBookingInFlight] = useState(false);
  const [activeBookingSessionId, setActiveBookingSessionId] = useState(null);
  const [lastFailedBookingSessionId, setLastFailedBookingSessionId] =
    useState(null);
  const bookingKeyBySessionRef = useRef(new Map());

  const prepareBookingRequest = useCallback(
    (sessionId) => {
      const existingKey = bookingKeyBySessionRef.current.get(sessionId);
      const requestKey =
        existingKey || createIdempotencyKey(`booking-${mentorId}-${sessionId}`);
      bookingKeyBySessionRef.current.set(sessionId, requestKey);

      setBookingInFlight(true);
      setActiveBookingSessionId(sessionId);

      return {
        requestKey,
        isRetry: lastFailedBookingSessionId === sessionId,
      };
    },
    [lastFailedBookingSessionId, mentorId],
  );

  const completeBookingRequest = useCallback((sessionId, succeeded) => {
    setBookingInFlight(false);
    setActiveBookingSessionId(null);

    if (succeeded) {
      setLastFailedBookingSessionId(null);
      bookingKeyBySessionRef.current.delete(sessionId);
      return;
    }

    setLastFailedBookingSessionId(sessionId);
  }, []);

  return {
    bookingInFlight,
    activeBookingSessionId,
    lastFailedBookingSessionId,
    prepareBookingRequest,
    completeBookingRequest,
  };
}
