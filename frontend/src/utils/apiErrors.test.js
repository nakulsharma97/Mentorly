import { describe, expect, it } from "vitest";
import { getApiErrorMessage, isRetryableApiError } from "./apiErrors";

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
