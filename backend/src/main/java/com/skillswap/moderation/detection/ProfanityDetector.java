package com.skillswap.moderation.detection;

import com.skillswap.moderation.DetectionSource;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Locale;

/**
 * Rule-based profanity filter. Swappable with a trained model later — the
 * {@link ModerationDetector} contract is the seam.
 */
@Component
public class ProfanityDetector implements ModerationDetector {

    private static final List<String> TERMS = List.of(
            "fuck", "shit", "bitch", "asshole", "bastard", "dick", "pussy",
            "motherfucker", "cunt", "whore", "retard", "nigger", "faggot");

    @Override
    public DetectionSource source() {
        return DetectionSource.PROFANITY_FILTER;
    }

    @Override
    public DetectionResult detect(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        for (String term : TERMS) {
            if (containsWord(lower, term)) {
                return DetectionResult.flagged("Profanity detected in content", 0.92);
            }
        }
        return DetectionResult.clean();
    }

    private static boolean containsWord(String text, String word) {
        return text.matches("(?s).*\\b" + java.util.regex.Pattern.quote(word) + "\\b.*");
    }
}
