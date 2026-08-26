package com.mentorly.moderation.detection;

import com.mentorly.moderation.DetectionSource;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Rule-based scam detector: payment-bait phrases, urgent money requests, and
 * outside-platform contact pressure. Swappable with a trained classifier.
 */
@Component
public class ScamDetector implements ModerationDetector {

    private static final String[] PHRASES = {
            "pay outside", "payment outside", "pay me directly", "bank transfer",
            "western union", "send money", "paypal friends", "upfront fee",
            "urgent payment", "refund to my account", "crypto payment", "bitcoin",
            "contact me on whatsapp", "telegram", "instagram direct"
    };

    @Override
    public DetectionSource source() {
        return DetectionSource.SCAM_DETECTION;
    }

    @Override
    public DetectionResult detect(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        int hits = 0;
        String first = null;
        for (String phrase : PHRASES) {
            if (lower.contains(phrase)) {
                hits++;
                if (first == null) {
                    first = phrase;
                }
            }
        }
        if (hits >= 2) {
            return DetectionResult.flagged("Multiple scam indicators — possible payment fraud", 0.9);
        }
        if (hits == 1) {
            return DetectionResult.flagged("Scam indicator: \"" + first + "\"", 0.7);
        }
        return DetectionResult.clean();
    }
}
