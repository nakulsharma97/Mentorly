package com.skillswap.chat;

import java.util.regex.Pattern;

/**
 * Utility for sanitizing chat message inputs to prevent XSS and other
 * injection attacks. Applied at the service layer before persisting messages.
 *
 * <p>Strips HTML tags rather than HTML-escaping because this is a JSON API
 * consumed by a React SPA where JSX text nodes already escape by default.
 * HTML-escaping would cause double-escaping (users seeing {@code &lt;} literally).
 */
/**
 * Encapsulates chat input sanitizer.
 */
public final class ChatInputSanitizer {

    /** Maximum allowed message content length (matches DB column: VARCHAR(2000)). */
    public static final int MAX_CONTENT_LENGTH = 2000;

    /** Regex to strip HTML/XML tags. */
    private static final Pattern HTML_TAG_PATTERN = Pattern.compile("<[^>]*>");

    private ChatInputSanitizer() {
        // Utility class — prevent instantiation
    }

    /**
     * Sanitizes raw user input for chat messages:
     * <ol>
     *   <li>Trims leading/trailing whitespace</li>
     *   <li>Strips HTML/XML tags to prevent XSS</li>
     *   <li>Normalizes repeated horizontal whitespace (preserves newlines)</li>
     *   <li>Truncates to {@value #MAX_CONTENT_LENGTH} characters</li>
     * </ol>
     *
     * @param raw the raw user input (may be null)
     * @return the sanitized string, or empty string if null/blank
     */
    public static String sanitize(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }

        String trimmed = raw.trim();

        // Strip HTML/XML tags entirely — prevents XSS vectors like <script>alert(1)</script>
        // without HTML-escaping (which would cause double-escaping in a React SPA)
        String stripped = HTML_TAG_PATTERN.matcher(trimmed).replaceAll("");

        // Normalize repeated horizontal whitespace from stripped tags (preserve newlines)
        String normalized = stripped.replaceAll("[ \\t]+", " ").trim();

        // Truncate to database column limit
        if (normalized.length() > MAX_CONTENT_LENGTH) {
            normalized = normalized.substring(0, MAX_CONTENT_LENGTH);
        }

        return normalized;
    }

    /**
     * Validates that the content is acceptable. Throws on invalid input.
     *
     * @param content the sanitized content (must not be empty or exceed max length)
     * @throws IllegalArgumentException if validation fails
     */
    public static void validate(String content) {
        if (content == null || content.isEmpty()) {
            throw new IllegalArgumentException("Message cannot be empty");
        }
        if (content.length() > MAX_CONTENT_LENGTH) {
            throw new IllegalArgumentException(
                    "Message exceeds maximum length of " + MAX_CONTENT_LENGTH + " characters");
        }
    }
}
