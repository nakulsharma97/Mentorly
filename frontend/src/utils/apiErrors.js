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
