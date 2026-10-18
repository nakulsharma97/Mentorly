import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import client, { API_BASE_URL } from "../../../api/client";
import { getApiErrorMessage as errorMessage } from "../../../utils/apiErrors";
import Icon from "../../common/dashboard/Icon";
import "./GoogleCalendarCard.css";

const STATUS_PATH = "/api/v1/admin/google-calendar/status";
const CONNECT_PATH = "/api/v1/admin/google-calendar/connect";

/**
 * Admin card for connecting the platform's Google account so live sessions can
 * receive Google Meet links. Mirrors the Stripe/Razorpay onboarding cards: a
 * status pill plus a single connect action.
 */
export default function GoogleCalendarCard({ notify }) {
  const [status, setStatus] = useState({ configured: false, connected: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const location = useLocation();
  const navigate = useNavigate();
  const handledResultRef = useRef("");

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await client.get(STATUS_PATH);
      const data = res?.data?.data || {};
      setStatus({
        configured: Boolean(data.configured),
        connected: Boolean(data.connected),
      });
    } catch (err) {
      setError(errorMessage(err, "Could not read the Google Calendar status."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // The OAuth callback sends the browser back to the admin area with
  // ?calendar=connected|error. Surface it once, then drop the query string.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const result = params.get("calendar");
    if (!result || handledResultRef.current === result) return;
    handledResultRef.current = result;

    notify?.({
      type: result === "connected" ? "success" : "error",
      title: result === "connected" ? "Google Calendar connected" : "Google Calendar connection failed",
      message:
        result === "connected"
          ? "New live sessions will now receive a Google Meet link automatically."
          : "Google did not return a usable token. Please try connecting again.",
    });

    params.delete("calendar");
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "" }, { replace: true });

    if (result === "connected") {
      loadStatus();
    }
  }, [location.pathname, location.search, navigate, notify, loadStatus]);

  const handleConnect = () => {
    // Full-page navigation so the browser carries the auth cookie through
    // Google and back to the callback endpoint.
    window.location.assign(`${API_BASE_URL}${CONNECT_PATH}`);
  };

  const stateLabel = loading
    ? "Checking…"
    : status.connected
      ? "Connected"
      : status.configured
        ? "Not connected"
        : "Not configured";

  const stateClass = loading
    ? "is-checking"
    : status.connected
      ? "is-on"
      : "is-off";

  return (
    <section className="gcal-card" aria-labelledby="gcal-card-title">
      <span className="gcal-card__icon" aria-hidden="true">
        <Icon name="video_camera_front" />
      </span>

      <div className="gcal-card__body">
        <div className="gcal-card__head">
          <h3 id="gcal-card-title">Google Calendar &amp; Meet</h3>
          <span className={`gcal-pill ${stateClass}`}>{stateLabel}</span>
        </div>
        <p>
          Connect one Google account to generate a Google Meet link for every live
          session. The refresh token is stored server-side, so the connection
          survives restarts and redeploys.
        </p>
        {!loading && !status.configured && (
          <p className="gcal-card__hint">
            Set <code>GOOGLE_CALENDAR_CLIENT_ID</code>,{" "}
            <code>GOOGLE_CALENDAR_CLIENT_SECRET</code> and{" "}
            <code>GOOGLE_CALENDAR_REDIRECT_URI</code> to enable this integration.
          </p>
        )}
        {error && (
          <p className="gcal-card__error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="gcal-card__actions">
        <button
          type="button"
          className="ss-btn ss-btn--primary"
          onClick={handleConnect}
          disabled={loading || !status.configured}
        >
          <Icon name="link" />
          {status.connected ? "Reconnect" : "Connect Google Calendar"}
        </button>
      </div>
    </section>
  );
}
