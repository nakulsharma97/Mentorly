import { describe, expect, it } from "vitest";
import {
  EMAIL_SEND_FAILED_MESSAGE,
  getApiErrorMessage,
  getEmailDeliveryErrorMessage,
  isConnectionError,
  isRequestTimeoutError,
  isRetryableApiError,
} from "./apiErrors";

describe("apiErrors helpers", () => {
  it("prefers structured backend error payloads", () => {
    const error = {
      response: {
        data: {
          data: {
            error: "Temporary booking conflict. Please retry.",
            retryable: true,
          },
        },
      },
    };

    expect(getApiErrorMessage(error, "fallback")).toBe(
      "Temporary booking conflict. Please retry.",
    );
    expect(isRetryableApiError(error)).toBe(true);
  });

  it("falls back to generic error text when payload is missing", () => {
    expect(getApiErrorMessage({}, "fallback")).toBe("fallback");
    expect(isRetryableApiError({})).toBe(false);
  });
});

describe("email delivery errors", () => {
  it("prefers the backend's structured reason, including the 503 message", () => {
    const notConfigured = {
      response: {
        status: 503,
        data: {
          message: "Email service is not configured.",
          data: { error: "Email service is not configured." },
        },
      },
    };
    expect(getEmailDeliveryErrorMessage(notConfigured)).toBe(
      "Email service is not configured.",
    );
  });

  it("maps timeouts and network failures to friendly copy", () => {
    expect(
      getEmailDeliveryErrorMessage(
        Object.assign(new Error("timeout of 20000ms exceeded"), {
          code: "ECONNABORTED",
        }),
      ),
    ).toBe(EMAIL_SEND_FAILED_MESSAGE);
    expect(
      getEmailDeliveryErrorMessage(
        Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }),
      ),
    ).toBe(EMAIL_SEND_FAILED_MESSAGE);
    expect(isRequestTimeoutError({ code: "ECONNABORTED" })).toBe(true);
    expect(isConnectionError({ code: "ERR_NETWORK" })).toBe(true);
    expect(isConnectionError({ response: { status: 500 } })).toBe(false);
  });

  it("honours a caller-supplied fallback", () => {
    expect(getEmailDeliveryErrorMessage({}, "custom fallback")).toBe(
      "custom fallback",
    );
  });
});
