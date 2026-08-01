package com.skillswap.moderation.detection;

import com.skillswap.moderation.DetectionSource;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Rule-based prompt-injection detector: tries to override an AI assistant's
 * instructions (ignore previous, act as, system prompt, output format, etc.).
 * Swappable with a dedicated LLM-safety classifier later.
 */
@Component
public class PromptInjectionDetector implements ModerationDetector {

    private static final Pattern PATTERN = Pattern.compile(
            "(?i)(ignore (all |any )?(previous|prior) instructions?|"
                    + "ignore the (above|system) prompt|"
                    + "you are now|act as if you are|"
                    + "reveal (your|the) system prompt|"
                    + "output your (instructions|system prompt)|"
                    + "disregard (the )?(rules|guidelines|policy)|"
                    + "jailbreak|do not follow|bypass (the )?(rules|safety)|"
                    + "pretend you have no|ignore your (rules|training))");

    @Override
    public DetectionSource source() {
        return DetectionSource.AI_MODERATION;
    }

    @Override
    public DetectionResult detect(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        if (PATTERN.matcher(lower).find()) {
            return DetectionResult.flagged("Prompt injection attempt detected", 0.95);
        }
        return DetectionResult.clean();
    }
}
