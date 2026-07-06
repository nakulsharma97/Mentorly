import { beforeEach, describe, expect, it } from "vitest";
import { persistAuthSession } from "./client";

describe("persistAuthSession", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("reads auth tokens from a nested axios-style login response", () => {
    const response = {
      data: {
        message: "Login successful",
        data: {
          token: "access-token-123",
          refreshToken: "refresh-token-123",
          email: "learner@example.com",
          role: "LEARNER",
        },
      },
    };

    const token = persistAuthSession(response);

    expect(token).toBe("access-token-123");
    expect(localStorage.getItem("token")).toBe("access-token-123");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-token-123");
  });

  it("falls back to cookies when the login response body is empty", () => {
    document.cookie = "access_token=access-token-cookie; path=/";
    document.cookie = "refresh_token=refresh-token-cookie; path=/";

    const token = persistAuthSession({ data: { message: "Login successful" } });

    expect(token).toBe("access-token-cookie");
    expect(localStorage.getItem("token")).toBe("access-token-cookie");
    expect(localStorage.getItem("refreshToken")).toBe("refresh-token-cookie");
  });
});
