import { beforeEach, describe, expect, it } from "vitest";
import {
  persistAuthSession,
  setAuthToken,
  getActiveAuthToken,
  extractJwtUserId,
  clearAuthSessionState,
  decodeJwtPayload,
} from "./client";

// ── Helpers ──

/** Create a minimal JWT-style string with the given JSON payload. */
function createTestJwt(payload) {
  const header = btoa(JSON.stringify({ alg: "HS384", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fake-signature-for-testing`;
}

/** Simulate logging in as user A by setting localStorage tokens + a cookie. */
function loginAsUserA() {
  window.localStorage.setItem("token", USER_A.token);
  window.localStorage.setItem("refreshToken", USER_A.refreshToken);
  window.localStorage.setItem("user", USER_A.email);
  window.localStorage.setItem("currentUser", JSON.stringify({ email: USER_A.email, role: USER_A.role }));
  window.sessionStorage.setItem("token", USER_A.token);
  document.cookie = "access_token=user-a-session-cookie; path=/";
  document.cookie = "refresh_token=user-a-refresh-cookie; path=/";
}

/** Read a cookie value by name. */
function readCookie(name) {
  const encodedName = `${encodeURIComponent(name)}=`;
  const found = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName));
  if (!found) return null;
  return decodeURIComponent(found.substring(encodedName.length));
}

// ── Test Users ──

const USER_A = {
  id: 17,
  email: "testmentor@test.com",
  role: "MENTOR",
  token: createTestJwt({
    jti: "user-a-jti",
    tokenType: "access",
    tokenId: "tok-a",
    userId: 17,
    sub: "testmentor@test.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  refreshToken: createTestJwt({
    jti: "user-a-refresh-jti",
    tokenType: "refresh",
    tokenId: "tok-a",
    userId: 17,
    sub: "testmentor@test.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 86400,
  }),
};

const USER_B = {
  id: 42,
  email: "testlearner@test.com",
  role: "LEARNER",
  token: createTestJwt({
    jti: "user-b-jti",
    tokenType: "access",
    tokenId: "tok-b",
    userId: 42,
    sub: "testlearner@test.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  refreshToken: createTestJwt({
    jti: "user-b-refresh-jti",
    tokenType: "refresh",
    tokenId: "tok-b",
    userId: 42,
    sub: "testlearner@test.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 86400,
  }),
};

const USER_C = {
  id: 99,
  email: "admin@skillswap.com",
  role: "ADMIN",
  token: createTestJwt({
    jti: "user-c-jti",
    tokenType: "access",
    tokenId: "tok-c",
    userId: 99,
    sub: "admin@skillswap.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 3600,
  }),
  refreshToken: createTestJwt({
    jti: "user-c-refresh-jti",
    tokenType: "refresh",
    tokenId: "tok-c",
    userId: 99,
    sub: "admin@skillswap.com",
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 86400,
  }),
};

// ── Auth response shapes ──

/** Full axios-style login response with nested token data. */
function loginResponseWithToken(user) {
  return {
    data: {
      message: "Login successful",
      data: {
        token: user.token,
        refreshToken: user.refreshToken,
        email: user.email,
        role: user.role,
      },
    },
  };
}

/** Login response body with no token — forces cookie fallback. */
const EMPTY_LOGIN_RESPONSE = { data: { message: "Login successful" } };

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE: persistAuthSession – Account Switching
// ═══════════════════════════════════════════════════════════════════════════

describe("persistAuthSession — account switching", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();

    // Clear any cookies that exist by setting them with an expiry in the past.
    // Vitest/jsdom does not clear cookies between tests automatically.
    ["access_token", "refresh_token", "accessToken", "refreshToken"].forEach((name) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });

  // ── Test 1: Core flow — switching accounts persists new token while old cookies
  //    are preserved. The backend fix (Bearer header priority over cookies) ensures
  //    the newly issued Bearer token takes precedence over any stale cookie.

  it("switches from user A to user B storing the new token and preserving existing cookies", () => {
    // Arrange: User A is already logged in (has localStorage tokens + cookies)
    loginAsUserA();
    const oldAccessCookie = readCookie("access_token");
    const oldRefreshCookie = readCookie("refresh_token");
    expect(oldAccessCookie).toBeTruthy();
    expect(oldRefreshCookie).toBeTruthy();

    // Act: User B logs in — response body contains User B's token
    const token = persistAuthSession(loginResponseWithToken(USER_B));

    // Assert: Returned token is User B's
    expect(token).toBe(USER_B.token);

    // Assert: localStorage now holds User B's data
    expect(localStorage.getItem("token")).toBe(USER_B.token);
    // SECURITY: the refresh token must never be persisted to web storage — it
    // lives only in the httpOnly refresh_token cookie. A response body that
    // contains a refreshToken is intentionally ignored for storage.
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(sessionStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBe(USER_B.email);
    expect(JSON.parse(localStorage.getItem("currentUser"))).toEqual({
      email: USER_B.email,
      role: USER_B.role,
    });

    // Assert: Old cookies are PRESERVED (frontend keeps them; backend will
    // use the Bearer token over cookies after the JwtAuthenticationFilter fix)
    expect(readCookie("access_token")).toBe(oldAccessCookie);
    expect(readCookie("refresh_token")).toBe(oldRefreshCookie);
  });

  // ── Test 2: Cookies preserved when response has no token ──

  it("preserves existing cookies when the login response body has no token (cookie fallback)", () => {
    // Arrange: User A has cookies
    document.cookie = "access_token=user-a-session-cookie; path=/";
    document.cookie = "refresh_token=user-a-refresh-cookie; path=/";

    // Act: Login response has no token — must fall back to cookies
    const token = persistAuthSession(EMPTY_LOGIN_RESPONSE);

    // Assert: Cookie values are preserved and returned
    expect(token).toBe("user-a-session-cookie");
    expect(readCookie("access_token")).toBe("user-a-session-cookie");
    expect(readCookie("refresh_token")).toBe("user-a-refresh-cookie");

    // Assert: Token is stored from cookie fallback, but the refresh token is
    // still never written to web storage (cookie-only by design).
    expect(localStorage.getItem("token")).toBe("user-a-session-cookie");
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(sessionStorage.getItem("refreshToken")).toBeNull();
  });

  // ── Test 3: Old auth state is fully replaced ──

  it("replaces all old auth state with new user's data when switching accounts", () => {
    // Arrange: User A is logged in
    loginAsUserA();

    // Act: Switch to User B
    persistAuthSession(loginResponseWithToken(USER_B));

    // Assert: User A's data is gone from localStorage
    expect(localStorage.getItem("token")).not.toBe(USER_A.token);
    expect(localStorage.getItem("user")).not.toBe(USER_A.email);

    // Assert: Only User B's data exists (refresh token stays cookie-only)
    expect(localStorage.getItem("token")).toBe(USER_B.token);
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBe(USER_B.email);
  });

  // ── Test 4: in-memory activeAuthToken is updated to new user ──

  it("updates the in-memory active auth token to the new user", () => {
    // Arrange: Start clean
    clearAuthSessionState();

    // Act: Log in as User B
    persistAuthSession(loginResponseWithToken(USER_B));

    // Assert: getActiveAuthToken returns User B's token
    const activeToken = getActiveAuthToken();
    expect(activeToken).toBe(USER_B.token);

    // Verify the JWT payload decodes to User B's userId
    expect(extractJwtUserId(activeToken)).toBe(USER_B.id);
  });

  // ── Test 5: Non-auth data (language, theme) is preserved across switches ──

  it("preserves non-auth data like language and theme preference when switching accounts", () => {
    // Arrange: Set up non-auth data alongside User A's session
    window.localStorage.setItem("language", "es");
    window.localStorage.setItem("theme-preference", "dark");
    loginAsUserA();

    // Act: Switch to User B
    persistAuthSession(loginResponseWithToken(USER_B));

    // Assert: Language and theme are still intact
    expect(localStorage.getItem("language")).toBe("es");
    expect(localStorage.getItem("theme-preference")).toBe("dark");

    // Assert: Auth data is for User B
    expect(localStorage.getItem("token")).toBe(USER_B.token);
    expect(localStorage.getItem("user")).toBe(USER_B.email);
  });

  // ── Test 6: Sequential switches (A → B → A) ──

  it("handles sequential account switches: User A → User B → User A", () => {
    // Act 1: Log in as User A
    persistAuthSession(loginResponseWithToken(USER_A));
    expect(extractJwtUserId(getActiveAuthToken())).toBe(USER_A.id);

    // Act 2: Switch to User B
    persistAuthSession(loginResponseWithToken(USER_B));
    expect(extractJwtUserId(getActiveAuthToken())).toBe(USER_B.id);
    expect(localStorage.getItem("user")).toBe(USER_B.email);

    // Act 3: Switch back to User A
    persistAuthSession(loginResponseWithToken(USER_A));
    expect(extractJwtUserId(getActiveAuthToken())).toBe(USER_A.id);
    expect(localStorage.getItem("user")).toBe(USER_A.email);
    expect(localStorage.getItem("token")).toBe(USER_A.token);
  });

  // ── Test 7: Three-way switch (A → B → C) ──

  it("handles three-way account switches: User A → User B → User C", () => {
    persistAuthSession(loginResponseWithToken(USER_A));
    expect(extractJwtUserId(getActiveAuthToken())).toBe(USER_A.id);

    persistAuthSession(loginResponseWithToken(USER_B));
    expect(extractJwtUserId(getActiveAuthToken())).toBe(USER_B.id);

    persistAuthSession(loginResponseWithToken(USER_C));
    expect(extractJwtUserId(getActiveAuthToken())).toBe(USER_C.id);
    expect(localStorage.getItem("token")).toBe(USER_C.token);
    expect(localStorage.getItem("user")).toBe(USER_C.email);
    expect(JSON.parse(localStorage.getItem("currentUser"))).toEqual({
      email: USER_C.email,
      role: USER_C.role,
    });

    // Ensure no trace of User A or B remains
    expect(localStorage.getItem("token")).not.toBe(USER_A.token);
    expect(localStorage.getItem("token")).not.toBe(USER_B.token);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE: extractJwtUserId – Cross-account JWT parsing
// ═══════════════════════════════════════════════════════════════════════════

describe("extractJwtUserId — cross-account identification", () => {
  it("extracts user ID 17 from User A's token", () => {
    expect(extractJwtUserId(USER_A.token)).toBe(17);
  });

  it("extracts user ID 42 from User B's token", () => {
    expect(extractJwtUserId(USER_B.token)).toBe(42);
  });

  it("extracts user ID 99 from User C's token", () => {
    expect(extractJwtUserId(USER_C.token)).toBe(99);
  });

  it("returns null for a malformed token", () => {
    expect(extractJwtUserId("not-a-valid-jwt")).toBeNull();
  });

  it("returns null for null/undefined input", () => {
    expect(extractJwtUserId(null)).toBeNull();
    expect(extractJwtUserId(undefined)).toBeNull();
  });

  it("extracts userId from the 'sub' claim when 'userId' is absent", () => {
    const token = createTestJwt({ sub: 55, role: "LEARNER" });
    expect(extractJwtUserId(token)).toBe(55);
  });

  it("prefers 'userId' over 'sub' when both are present", () => {
    const token = createTestJwt({ userId: 17, sub: "test@test.com" });
    expect(extractJwtUserId(token)).toBe(17);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE: decodeJwtPayload – Token parsing
// ═══════════════════════════════════════════════════════════════════════════

describe("decodeJwtPayload", () => {
  it("decodes a valid JWT payload", () => {
    const payload = decodeJwtPayload(USER_A.token);
    expect(payload).toBeInstanceOf(Object);
    expect(payload.userId).toBe(17);
    expect(payload.sub).toBe("testmentor@test.com");
    expect(payload.tokenType).toBe("access");
  });

  it("returns null for a token with fewer than 2 segments", () => {
    expect(decodeJwtPayload("only-one-dot.no")).toBeNull();
    expect(decodeJwtPayload("no-dots")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(decodeJwtPayload("")).toBeNull();
  });

  it("returns null when payload is not valid JSON", () => {
    const badToken = `header.${btoa("not-json")}.signature`;
    expect(decodeJwtPayload(badToken)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE: setAuthToken & getActiveAuthToken – Token lifecycle
// ═══════════════════════════════════════════════════════════════════════════

describe("setAuthToken and getActiveAuthToken", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuthSessionState();
  });

  it("stores a token and retrieves it", () => {
    setAuthToken(USER_A.token);
    expect(getActiveAuthToken()).toBe(USER_A.token);
    expect(localStorage.getItem("token")).toBe(USER_A.token);
    expect(sessionStorage.getItem("token")).toBe(USER_A.token);
  });

  it("returns null when no token is set", () => {
    expect(getActiveAuthToken()).toBeNull();
  });

  it("returns null for an expired token", () => {
    const expiredPayload = {
      userId: 17,
      sub: "test@test.com",
      exp: Math.floor(Date.now() / 1000) - 10, // 10 seconds in the past
    };
    const expiredToken = createTestJwt(expiredPayload);
    setAuthToken(expiredToken);
    expect(getActiveAuthToken()).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  SUITE: Edge cases
// ═══════════════════════════════════════════════════════════════════════════

describe("persistAuthSession — edge cases", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    ["access_token", "refresh_token", "accessToken", "refreshToken"].forEach((name) => {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });
  });

  it("handles a response where only some fields are present", () => {
    const partial = {
      data: {
        data: {
          token: USER_B.token,
          // no refreshToken, no email, no role
        },
      },
    };
    const token = persistAuthSession(partial);
    expect(token).toBe(USER_B.token);
    expect(localStorage.getItem("token")).toBe(USER_B.token);
    // Optional fields should not be set
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("handles a response with jwt field instead of token", () => {
    const response = {
      data: {
        data: {
          jwt: USER_B.token,
          refreshToken: USER_B.refreshToken,
          email: USER_B.email,
          role: USER_B.role,
        },
      },
    };
    const token = persistAuthSession(response);
    expect(token).toBe(USER_B.token);
    expect(localStorage.getItem("token")).toBe(USER_B.token);
  });

  it("handles a response with accessToken field instead of token", () => {
    const response = {
      data: {
        data: {
          accessToken: USER_B.token,
          refreshToken: USER_B.refreshToken,
          email: USER_B.email,
          role: USER_B.role,
        },
      },
    };
    const token = persistAuthSession(response);
    expect(token).toBe(USER_B.token);
    expect(localStorage.getItem("token")).toBe(USER_B.token);
  });

  it("returns null when neither response body nor cookies contain a token", () => {
    const token = persistAuthSession(EMPTY_LOGIN_RESPONSE);
    expect(token).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("handles null/undefined authResponse gracefully", () => {
    const token1 = persistAuthSession(null);
    expect(token1).toBeNull();

    const token2 = persistAuthSession(undefined);
    expect(token2).toBeNull();
  });
});
