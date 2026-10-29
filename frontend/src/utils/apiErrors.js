export const getApiErrorMessage = (error, fallback = "Request failed") => {
  const responseData = error?.response?.data;
  const details = responseData?.data;
  if (details?.error || details?.message) {
    return String(details.error || details.message);
  }
  if (details?.errors && typeof details.errors === "object") {
    return Object.values(details.errors).join("; ");
  }
  if (responseData?.message) {
    return String(responseData.message);
  }
  return String(error?.message || fallback);
};

export const isRetryableApiError = (error) =>
  Boolean(error?.response?.data?.data?.retryable);

/**
 * Axios reports its own per-request timeout as ECONNABORTED (and Node-style
 * stacks as ETIMEDOUT). A bare "timeout of 20000ms exceeded" is meaningless to
 * a user, so these map to the caller's friendly message instead.
 */
export const isRequestTimeoutError = (error) =>
  error?.code === "ECONNABORTED" || error?.code === "ETIMEDOUT";

/**
 * Nothing reached the server: DNS failure, offline, blocked port, CORS…
 * Such errors carry no `response` at all.
 */
export const isConnectionError = (error) =>
  !error?.response &&
  (error?.code === "ERR_NETWORK" || error?.code === "ECONNRESET" || isRequestTimeoutError(error));

export const EMAIL_SEND_FAILED_MESSAGE =
  "We couldn't send the verification code. Please try again in a moment.";

/**
 * Error text for a code-delivery call (signup OTP, resend, password reset).
 * Server messages win — including the backend's "Email service is not
 * configured." 503 — while timeouts and network failures fall back to the
 * friendly copy instead of leaking axios internals.
 */
export const getEmailDeliveryErrorMessage = (error, fallback = EMAIL_SEND_FAILED_MESSAGE) => {
  const responseData = error?.response?.data;
  // The structured payload carries the real reason; the top-level "message"
  // is just "Request failed" on every handled backend error.
  if (responseData?.data?.error || responseData?.data?.message) {
    return String(responseData.data.error || responseData.data.message);
  }
  if (responseData?.message) {
    return String(responseData.message);
  }
  return fallback;
};
