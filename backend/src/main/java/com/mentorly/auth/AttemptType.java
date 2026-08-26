package com.mentorly.auth;

/**
 * Identifies which authentication flow a per-IP rate-limit counter belongs to.
 *
 * <p>Login failures and forgot-password requests used to share a single
 * counter per IP, so one flow could exhaust the other's quota and a login
 * lockout also blocked password resets. Each flow now keeps its own counter
 * and lockout state, keyed by this type.
 */
/**
 * Enumerates attempt type.
 */
public enum AttemptType {
    /** Failed (and blocked) password login attempts. */
    LOGIN,

    /** Forgot-password / password-reset request flow. */
    FORGOT_PASSWORD,

    /** OAuth2 login / account-creation flow (per-IP throttle). */
    OAUTH_LOGIN
}
