package com.skillswap.common;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Single source of truth for username rules across the platform:
 * <ul>
 *   <li>4–30 characters</li>
 *   <li>Only {@code A-Z a-z 0-9 _ . -} (at least one letter/digit — a bare
 *       run of dots/hyphens is not a meaningful handle)</li>
 *   <li>Uniqueness is case-insensitive: {@code nakul}, {@code Nakul} and
 *       {@code NAKUL} are the same username. The display value is stored
 *       exactly as the user typed it; a normalized lowercase copy
 *       ({@code username_lower}) enforces uniqueness at the DB level.</li>
 *   <li>A reserved-word blocklist prevents impersonation of system accounts.</li>
 * </ul>
 */
public final class UsernameRules {

    public static final int MIN_LENGTH = 4;
    public static final int MAX_LENGTH = 30;

    /** Valid characters: A-Z, a-z, 0-9, underscore, dot, hyphen. */
    public static final Pattern PATTERN =
            Pattern.compile("^[A-Za-z0-9._-]{" + MIN_LENGTH + "," + MAX_LENGTH + "}$");

    /** Usernames must contain at least one letter or digit. */
    private static final Pattern HAS_ALPHANUMERIC = Pattern.compile("[A-Za-z0-9]");

    public static final String FORMAT_ERROR_MESSAGE =
            "Username must be " + MIN_LENGTH + "\u2013" + MAX_LENGTH
                    + " characters and may only contain letters, numbers, "
                    + "underscores (_), dots (.) and hyphens (-).";

    /** Reserved handles that can never be claimed by a regular account. */
    public static final Set<String> RESERVED_USERNAMES = Set.of(
            "admin", "support", "login", "register", "signup", "mentor", "learner",
            "settings", "profile", "api", "root", "system", "mentorly", "skillswap", "skillswapper",
            "moderator", "help", "info", "mail", "noreply", "test", "null", "undefined");

    private UsernameRules() {
    }

    /** Trims surrounding whitespace (never lowercases — display case is preserved). */
    public static String normalize(String username) {
        return username == null ? null : username.trim();
    }

    /** Trims surrounding whitespace and lowercases for uniqueness comparison. */
    public static String normalizeLower(String username) {
        String normalized = normalize(username);
        return normalized == null ? null : normalized.toLowerCase(Locale.ROOT);
    }

    /** True when the value matches the character/length rules. */
    public static boolean isValidFormat(String username) {
        String normalized = normalize(username);
        return normalized != null
                && PATTERN.matcher(normalized).matches()
                && HAS_ALPHANUMERIC.matcher(normalized).find();
    }

    /** True when the value is a reserved platform handle (case-insensitive). */
    public static boolean isReserved(String username) {
        String lower = normalizeLower(username);
        return lower != null && RESERVED_USERNAMES.contains(lower);
    }

    /**
     * Throws {@link IllegalArgumentException} when the username does not conform
     * to the format rules. Reserved-word checks are separate so callers can
     * return their own status code.
     */
    public static void validateFormat(String username) {
        if (!isValidFormat(username)) {
            throw new IllegalArgumentException(FORMAT_ERROR_MESSAGE);
        }
    }
}
