package com.mentorly.common;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Scheme validation for user-supplied links that end up in {@code <a href>}.
 * A stored {@code javascript:} URL executes in the reader's origin on click —
 * the SPA keeps its access token in localStorage, so that is account takeover.
 */
class HttpUrlsTest {

    // ── requireHttpUrl: absolute web links only ────────────────────────

    @Test
    void requireHttpUrlAcceptsHttpAndHttps() {
        assertEquals("https://github.com/mentorly", HttpUrls.requireHttpUrl("https://github.com/mentorly"));
        assertEquals("http://example.com/x", HttpUrls.requireHttpUrl("http://example.com/x"));
        assertEquals("HTTPS://Example.com", HttpUrls.requireHttpUrl("  HTTPS://Example.com  "));
    }

    @Test
    void requireHttpUrlTreatsNullAndBlankAsAbsent() {
        assertNull(HttpUrls.requireHttpUrl(null));
        assertNull(HttpUrls.requireHttpUrl(""));
        assertNull(HttpUrls.requireHttpUrl("   "));
    }

    @Test
    void requireHttpUrlRejectsExecutableSchemes() {
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireHttpUrl("javascript:alert(document.cookie)"));
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireHttpUrl("JaVaScRiPt:alert(1)"));
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireHttpUrl("data:text/html;base64,PHNjcmlwdD4="));
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireHttpUrl("vbscript:msgbox(1)"));
        // Relative paths are not valid meeting/external links either.
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireHttpUrl("/api/v1/files/1"));
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireHttpUrl("//evil.example.com/path"));
    }

    // ── requireSafeLink: rejects schemes, keeps relative file paths ────

    @Test
    void requireSafeLinkAllowsRelativePathsAndWebSchemes() {
        assertEquals("/api/v1/files/42", HttpUrls.requireSafeLink("  /api/v1/files/42  "));
        assertEquals("https://files.example.com/cv.pdf", HttpUrls.requireSafeLink("https://files.example.com/cv.pdf"));
        assertEquals("mailto:mentor@mentorly.app", HttpUrls.requireSafeLink("mailto:mentor@mentorly.app"));
        assertNull(HttpUrls.requireSafeLink(null));
        assertNull(HttpUrls.requireSafeLink(""));
    }

    @Test
    void requireSafeLinkRejectsExecutableSchemes() {
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireSafeLink("javascript:alert(document.cookie)"));
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireSafeLink("JAVASCRIPT:alert(1)"));
        assertThrows(IllegalArgumentException.class,
                () -> HttpUrls.requireSafeLink("data:text/html,<script>alert(1)</script>"));
    }

    @Test
    void requireSafeLinkDoesNotMistakePathSegmentsForSchemes() {
        // ':' after '/' is part of the path, not a scheme (e.g. Windows-style
        // or timestamp-looking segments) and must not be rejected.
        assertEquals("files/report:2026.pdf", HttpUrls.requireSafeLink("files/report:2026.pdf"));
        assertTrue(HttpUrls.requireSafeLink("https://x.test/a:b").startsWith("https://"));
    }
}
