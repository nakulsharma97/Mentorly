package com.mentorly.moderation.detection;

import com.mentorly.moderation.DetectionSource;
import org.springframework.stereotype.Component;

import java.util.Locale;

/**
 * Rule-based fake-certificate detector: claims of instantly-obtained or
 * purchased certificates from well-known institutions. Swappable with a real
 * credential-verification model later.
 */
@Component
public class FakeCertificateDetector implements ModerationDetector {

    private static final String[] PHRASES = {
            "buy certificate", "purchase certificate", "fake certificate",
            "certificate without exam", "instant certificate", "diploma mill",
            "no study", "pass without exam", "verified certificate for sale"
    };

    @Override
    public DetectionSource source() {
        return DetectionSource.FAKE_CERTIFICATE_DETECTION;
    }

    @Override
    public DetectionResult detect(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        for (String phrase : PHRASES) {
            if (lower.contains(phrase)) {
                return DetectionResult.flagged("Possible fabricated certificate: \"" + phrase + "\"", 0.88);
            }
        }
        return DetectionResult.clean();
    }
}
