package com.mentorly.common;

import java.util.Locale;

/**
 * URL scheme validation for user-supplied link fields.
 *
 * <p>These values end up in {@code <a href={...}>} on other people's screens —
 * a mentor's GitHub link on a public profile, a session's meeting link on a
 * learner's dashboard, a project's live-demo link, an applicant's resume on the
 * admin verification queue. React escapes text but it does NOT sanitize
 * {@code href} schemes, so a stored {@code javascript:} URL executes in the
 * victim's origin on click (the SPA keeps its access token in localStorage,
 * which makes that account takeover).
 *
 * <p>Every write path that feeds an anchor must funnel through here. Reads are
 * deliberately not patched in twenty JSX files — validating on write also keeps
 * bad data out of the database.
 */
public final class HttpUrls {

    private HttpUrls() {
    }

    /**
     * Null-safe strict check for fields that must be absolute web links
     * (meeting links, GitHub/portfolio/demo URLs).
     *
     * @param url raw user input (may be null or blank)
     * @return the trimmed URL, or {@code null} when input was null/blank
     * @throws IllegalArgumentException when a non-http(s) scheme is present
     */
    public static String requireHttpUrl(String url) {
        String trimmed = trimToNull(url);
        if (trimmed == null) {
            return null;
        }
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            throw new IllegalArgumentException("URL must start with http:// or https://");
        }
        return trimmed;
    }

    /**
     * Null-safe check that rejects dangerous schemes while still allowing
     * same-origin paths (uploaded files are stored as {@code /api/v1/files/...}).
     *
     * @param url raw user input (may be null or blank)
     * @return the trimmed link, or {@code null} when input was null/blank
     * @throws IllegalArgumentException for any scheme other than http/https/mailto
     */
    public static String requireSafeLink(String url) {
        String trimmed = trimToNull(url);
        if (trimmed == null) {
            return null;
        }
        int colon = trimmed.indexOf(':');
        int delimiter = firstIndexOf(trimmed, '/', '?', '#');
        // RFC 3986: a scheme ends at the first ':' and cannot contain '/'.
        if (colon >= 0 && (delimiter < 0 || colon < delimiter)) {
            String scheme = trimmed.substring(0, colon).toLowerCase(Locale.ROOT);
            if (!scheme.equals("http") && !scheme.equals("https") && !scheme.equals("mailto")) {
                throw new IllegalArgumentException("URL scheme must be http, https or mailto");
            }
        }
        return trimmed;
    }

    private static int firstIndexOf(String value, char... candidates) {
        int earliest = -1;
        for (char candidate : candidates) {
            int index = value.indexOf(candidate);
            if (index >= 0 && (earliest < 0 || index < earliest)) {
                earliest = index;
            }
        }
        return earliest;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
