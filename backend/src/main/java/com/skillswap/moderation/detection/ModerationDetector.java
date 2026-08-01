package com.skillswap.moderation.detection;

import com.skillswap.moderation.DetectionSource;

/**
 * Contract for a modular content-detection pipeline. Each detector inspects a
 * piece of text/content and returns a result. Implementations are discovered
 * via Spring (all beans of this type are run by {@link ModerationScanner}),
 * so adding a new detection source is a matter of writing one implementation.
 *
 * <p>The five required detectors (profanity, spam, fake certificate, scam,
 * prompt injection) each implement this interface — concrete implementations
 * can be swapped for real AI models without touching the moderation flow.
 */
public interface ModerationDetector {

    /**
     * Which detection source this detector represents — used to tag flagged
     * items and to filter the queue by source.
     */
    DetectionSource source();

    /**
     * Inspects {@code content} and reports whether it should be flagged.
     *
     * @return a result with {@code flagged=true} and a reason when the content
     *         violates the rule this detector implements.
     */
    DetectionResult detect(String content);

    /** Result of a detection run. */
    record DetectionResult(boolean flagged, String reason, Double confidence) {

        public static DetectionResult clean() {
            return new DetectionResult(false, null, null);
        }

        public static DetectionResult flagged(String reason, double confidence) {
            return new DetectionResult(true, reason, Math.max(0.0, Math.min(1.0, confidence)));
        }
    }
}
