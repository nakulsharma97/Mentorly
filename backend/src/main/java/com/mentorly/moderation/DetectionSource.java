package com.mentorly.moderation;

/**
 * How a piece of content ended up in the moderation queue — a manual user
 * report or one of the automated detection pipelines.
 */
public enum DetectionSource {
    MANUAL_REPORT,
    AI_MODERATION,
    SPAM_DETECTION,
    PROFANITY_FILTER,
    DUPLICATE_DETECTION,
    SCAM_DETECTION,
    FAKE_CERTIFICATE_DETECTION,
    SUSPICIOUS_LINK_DETECTION,
    PHONE_NUMBER_DETECTION,
    EMAIL_DETECTION,
    PAYMENT_OUTSIDE_PLATFORM_DETECTION
}
