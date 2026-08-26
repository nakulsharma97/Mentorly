package com.mentorly.moderation.detection;

import com.mentorly.moderation.DetectionSource;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * Runs every registered {@link ModerationDetector} over a piece of content and
 * aggregates the results. If multiple detectors fire, the strongest signal
 * (highest confidence) wins so the flag carries a single primary source.
 */
/**
 * Encapsulates moderation scanner.
 */
@Service
@RequiredArgsConstructor
public class ModerationScanner {

    private final List<ModerationDetector> detectors;

    /**
     * Scans content and returns the strongest firing signal together with the
     * detector that produced it, so callers can tag the flag with a real source.
     */
    public ScanOutcome scanOutcome(String content) {
        if (content == null || content.isBlank()) {
            return new ScanOutcome(ModerationDetector.DetectionResult.clean(), null);
        }
        ModerationDetector.DetectionResult best = ModerationDetector.DetectionResult.clean();
        DetectionSource bestSource = null;
        for (ModerationDetector detector : detectors) {
            ModerationDetector.DetectionResult result = detector.detect(content);
            if (result != null && result.flagged()
                    && (!best.flagged()
                        || (result.confidence() != null && best.confidence() == null)
                        || (result.confidence() != null && best.confidence() != null
                                && result.confidence() > best.confidence()))) {
                best = result;
                bestSource = detector.source();
            }
        }
        return new ScanOutcome(best, bestSource);
    }

/**
 * Immutable data carrier for scan outcome.
 */
    public record ScanOutcome(ModerationDetector.DetectionResult result, DetectionSource source) {
        public boolean flagged() {
            return result() != null && result().flagged();
        }

        public String reason() {
            return result() == null ? null : result().reason();
        }

        public Double confidence() {
            return result() == null ? null : result().confidence();
        }
    }
}
