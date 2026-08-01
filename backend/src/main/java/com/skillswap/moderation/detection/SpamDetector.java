package com.skillswap.moderation.detection;

import com.skillswap.moderation.DetectionSource;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Rule-based spam detector: repeated URLs, excessive link density, and common
 * spam keywords. Swappable with a trained classifier later.
 */
@Component
public class SpamDetector implements ModerationDetector {

    private static final Pattern URL = Pattern.compile("https?://|www\\.");
    private static final Pattern PHONE = Pattern.compile("\\+?\\d[\\d\\s\\-()]{7,}\\d");
    private static final String[] KEYWORDS = {
            "free vip", "click here", "earn money", "cash prize", "winner",
            "limited offer", "act now", "buy now", "discount code"
    };

    @Override
    public DetectionSource source() {
        return DetectionSource.SPAM_DETECTION;
    }

    @Override
    public DetectionResult detect(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        int urlCount = 0;
        var matcher = URL.matcher(content);
        while (matcher.find()) {
            urlCount++;
        }
        if (urlCount >= 3) {
            return DetectionResult.flagged("Content contains multiple links — possible spam", 0.85);
        }
        if (PHONE.matcher(content).find() && urlCount > 0) {
            return DetectionResult.flagged("Phone number combined with links — possible spam", 0.8);
        }
        for (String kw : KEYWORDS) {
            if (lower.contains(kw)) {
                return DetectionResult.flagged("Spam keyword detected: \"" + kw + "\"", 0.75);
            }
        }
        return DetectionResult.clean();
    }
}
