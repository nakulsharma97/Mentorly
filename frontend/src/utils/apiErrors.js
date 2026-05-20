export const getApiErrorMessage = (error, fallback = "Request failed") => {
  const data = error?.response?.data?.data;
  return String(data?.error || data?.message || error?.message || fallback);
};

export const isRetryableApiError = (error) =>
  Boolean(error?.response?.data?.data?.retryable);
