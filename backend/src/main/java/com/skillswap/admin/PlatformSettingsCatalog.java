package com.skillswap.admin;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Single source of truth for every platform configuration setting exposed in
 * the Admin → Platform Configuration Center. Each definition carries its
 * category, input type, label, description, default value and (for selects)
 * allowed options — so the admin UI renders itself from this catalog instead
 * of hardcoding anything.
 *
 * <p>Settings are persisted as key/value rows in {@code admin_settings}
 * (existing {@link AdminSetting} entity) — no schema change required. Values
 * are stored as strings; boolean/number coercion happens at read time.
 */
/**
 * Encapsulates platform settings catalog.
 */
public final class PlatformSettingsCatalog {

    private PlatformSettingsCatalog() {
    }

    // ── Categories (ordered for the UI) ──────────────────────────────

    public static final String CAT_GENERAL = "general";
    public static final String CAT_SECURITY = "security";
    public static final String CAT_NOTIFICATIONS = "notifications";
    public static final String CAT_PAYMENTS = "payments";
    public static final String CAT_SESSIONS = "sessions";
    public static final String CAT_AI = "ai";
    public static final String CAT_MODERATION = "moderation";
    public static final String CAT_EMAIL = "email";
    public static final String CAT_REGISTRATION = "registration";
    public static final String CAT_FEATURES = "features";
    public static final String CAT_APPEARANCE = "appearance";
    public static final String CAT_MAINTENANCE = "maintenance";

/**
 * Immutable data carrier for category.
 */
    public record Category(String id, String label, String description) { }

    public static final List<Category> CATEGORIES = List.of(
            new Category(CAT_GENERAL, "General", "Platform identity, contact and branding."),
            new Category(CAT_REGISTRATION, "Registration", "Sign-up rules and default roles."),
            new Category(CAT_SECURITY, "Security", "Password policy, sessions and login hardening."),
            new Category(CAT_NOTIFICATIONS, "Notifications", "Which platform events trigger admin notifications."),
            new Category(CAT_PAYMENTS, "Payments", "Fees, wallet limits and refund behavior."),
            new Category(CAT_SESSIONS, "Sessions", "Duration, booking and cancellation rules."),
            new Category(CAT_AI, "AI Features", "Toggles and thresholds for AI-powered features."),
            new Category(CAT_MODERATION, "Moderation", "Automated flagging and review workflow."),
            new Category(CAT_EMAIL, "Email", "SMTP delivery and sender identity."),
            new Category(CAT_FEATURES, "Feature Toggles", "Global on/off switches for platform features."),
            new Category(CAT_APPEARANCE, "Appearance", "Theme, accent and default layout."),
            new Category(CAT_MAINTENANCE, "Maintenance", "Maintenance mode and operational tools."));

/**
 * Immutable data carrier for setting def.
 */
    public record SettingDef(String key, String category, String type, String label,
            String description, String defaultValue, List<String> options) {
    }

    // ── Definition list ──────────────────────────────────────────────

    public static final List<SettingDef> DEFINITIONS = List.of(
            // ── General ──
            def(CAT_GENERAL, "platform_name", "text", "Platform Name",
                    "The display name shown across the platform.", "SkillSwap"),
            def(CAT_GENERAL, "platform_logo_url", "text", "Platform Logo URL",
                    "Public URL of the logo used in the header and emails.", ""),
            def(CAT_GENERAL, "support_email", "email", "Support Email",
                    "Contact address shown in the footer and support flows.", "support@skillswap.com"),
            def(CAT_GENERAL, "support_phone", "text", "Support Phone",
                    "Contact phone number for support (optional).", ""),
            def(CAT_GENERAL, "default_timezone", "select", "Default Timezone",
                    "Timezone applied when none is chosen by the user.",
                    "UTC", List.of("UTC", "Asia/Kolkata", "America/New_York", "Europe/London",
                            "Europe/Paris", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "America/Los_Angeles")),
            def(CAT_GENERAL, "platform_language", "select", "Platform Language",
                    "Default UI language for new users.", "en",
                    List.of("en", "es", "fr", "de", "hi", "ar", "pt")),
            def(CAT_GENERAL, "maintenance_banner", "text", "Maintenance Banner",
                    "Message displayed to users during planned maintenance.", ""),
            def(CAT_GENERAL, "platform_version", "text", "Platform Version",
                    "Version string shown in the admin console.", "2.4.0"),
            def(CAT_GENERAL, "company_name", "text", "Company Name",
                    "Legal company name used on invoices and contracts.", "SkillSwap Inc."),

            // ── Registration ──
            bool(CAT_REGISTRATION, "new_registrations_enabled", "New Registrations Enabled",
                    "Allow new users to sign up.", "true"),
            bool(CAT_REGISTRATION, "allow_mentor_registration", "Mentor Registration Allowed",
                    "Allow new users to register as mentors.", "true"),
            bool(CAT_REGISTRATION, "require_email_verification", "Require Email Verification",
                    "Require users to verify their email before signing in.", "false"),
            bool(CAT_REGISTRATION, "require_admin_approval", "Require Admin Approval",
                    "New mentor accounts must be approved by an admin before going live.", "false"),
            def(CAT_REGISTRATION, "default_user_role", "select", "Default User Role",
                    "Role assigned to newly registered users.", "LEARNER",
                    List.of("LEARNER", "MENTOR")),

            // ── Security ──
            def(CAT_SECURITY, "password_min_length", "number", "Password Minimum Length",
                    "Minimum character length for user passwords.", "8"),
            bool(CAT_SECURITY, "password_require_special", "Require Special Characters",
                    "Passwords must include at least one special character.", "true"),
            bool(CAT_SECURITY, "password_require_numbers", "Require Numbers",
                    "Passwords must include at least one number.", "true"),
            bool(CAT_SECURITY, "password_require_uppercase", "Require Uppercase",
                    "Passwords must include at least one uppercase letter.", "true"),
            def(CAT_SECURITY, "session_timeout_minutes", "number", "Session Timeout (minutes)",
                    "Idle time after which a user session expires.", "120"),
            def(CAT_SECURITY, "max_login_attempts", "number", "Maximum Login Attempts",
                    "Failed attempts allowed before the account is temporarily locked.", "5"),
            def(CAT_SECURITY, "jwt_expiration_minutes", "number", "JWT Expiration (minutes)",
                    "Lifetime of an access token before it must be refreshed.", "30"),
            bool(CAT_SECURITY, "enable_two_factor", "Enable Two-Factor Authentication",
                    "Offer two-factor authentication to all users (future ready).", "false"),
            bool(CAT_SECURITY, "enable_captcha", "Enable CAPTCHA",
                    "Require CAPTCHA on login and signup forms.", "false"),
            bool(CAT_SECURITY, "enable_email_verification", "Enable Email Verification",
                    "Global switch for the email verification flow.", "true"),

            // ── Payments ──
            def(CAT_PAYMENTS, "platform_fee_percent", "number", "Transaction Fee (%)",
                    "Percentage deducted from mentor payouts as the platform fee.", "10"),
            def(CAT_PAYMENTS, "min_withdrawal_amount", "number", "Minimum Wallet Balance",
                    "Minimum balance (₹) a user can withdraw from their wallet.", "10"),
            def(CAT_PAYMENTS, "max_wallet_limit", "number", "Maximum Wallet Limit",
                    "Maximum wallet balance (₹) a wallet can hold (0 = unlimited).", "0"),
            bool(CAT_PAYMENTS, "enable_wallet", "Enable Wallet",
                    "Allow users to hold and spend their wallet balance in ₹.", "true"),
            bool(CAT_PAYMENTS, "auto_refund_enabled", "Auto Refund",
                    "Automatically refund cancelled sessions within the policy window.", "true"),
            def(CAT_PAYMENTS, "refund_policy", "text", "Refund Policy",
                    "Short public description of the refund policy.", "Full refund before the session starts"),

            // ── Sessions ──
            def(CAT_SESSIONS, "default_session_duration", "number", "Default Session Duration (min)",
                    "Default length of a newly created session.", "60"),
            def(CAT_SESSIONS, "max_session_duration", "number", "Maximum Session Duration (min)",
                    "Longest allowed session length.", "240"),
            def(CAT_SESSIONS, "max_session_participants", "number", "Max Session Participants",
                    "Default maximum participants per session.", "10"),
            def(CAT_SESSIONS, "cancellation_window_hours", "number", "Cancellation Window (hours)",
                    "How long before a session users can cancel without penalty.", "24"),
            def(CAT_SESSIONS, "booking_window_days", "number", "Booking Window (days)",
                    "How far in advance sessions can be booked.", "30"),
            def(CAT_SESSIONS, "reschedule_limit", "number", "Reschedule Limit",
                    "Maximum times a booking can be rescheduled.", "2"),

            // ── AI ──
            bool(CAT_AI, "enable_ai_features", "Enable AI Features",
                    "Master switch for all AI-powered features.", "false"),
            bool(CAT_AI, "enable_ai_recommendations", "Enable AI Recommendations",
                    "Personalized mentor and session recommendations.", "false"),
            bool(CAT_AI, "enable_ai_moderation", "Enable AI Moderation",
                    "Automated content moderation using AI detection.", "false"),
            bool(CAT_AI, "enable_ai_resume_review", "Enable AI Resume Review",
                    "AI-assisted resume and profile review for mentors.", "false"),
            bool(CAT_AI, "enable_ai_skill_matching", "Enable AI Skill Matching",
                    "Match learners to mentors by skill similarity.", "false"),
            def(CAT_AI, "ai_confidence_threshold", "number", "Confidence Threshold (%)",
                    "Minimum confidence score for AI moderation actions.", "80"),

            // ── Moderation ──
            bool(CAT_MODERATION, "auto_flag_profanity", "Auto-Flag Profanity",
                    "Automatically flag content containing profanity.", "true"),
            bool(CAT_MODERATION, "auto_flag_spam", "Auto-Flag Spam",
                    "Automatically flag content detected as spam.", "true"),
            bool(CAT_MODERATION, "auto_flag_external_links", "Auto-Flag External Links",
                    "Flag messages that contain external links.", "false"),
            bool(CAT_MODERATION, "auto_flag_phone_numbers", "Auto-Flag Phone Numbers",
                    "Flag messages that contain phone numbers.", "false"),
            bool(CAT_MODERATION, "auto_flag_payment_requests", "Auto-Flag Payment Requests",
                    "Flag off-platform payment requests.", "true"),
            bool(CAT_MODERATION, "enable_manual_review", "Enable Manual Review",
                    "Require an admin to review flagged content before action.", "true"),

            // ── Email ──
            def(CAT_EMAIL, "smtp_host", "text", "SMTP Host",
                    "Outgoing mail server hostname.", ""),
            def(CAT_EMAIL, "smtp_port", "number", "SMTP Port",
                    "Outgoing mail server port.", "587"),
            def(CAT_EMAIL, "email_sender", "email", "Sender Email",
                    "From-address used on all outbound email.", "no-reply@skillswap.com"),
            def(CAT_EMAIL, "email_sender_name", "text", "Sender Name",
                    "Display name used on all outbound email.", "SkillSwap"),
            def(CAT_EMAIL, "email_reply_to", "email", "Reply-To Email",
                    "Address users reply to on outbound email.", "support@skillswap.com"),

            // ── Feature Toggles ──
            bool(CAT_FEATURES, "enable_payments", "Enable Payments",
                    "Allow payments and escrow on the platform.", "true"),
            bool(CAT_FEATURES, "enable_skill_verification", "Enable Skill Verification",
                    "Allow learners to verify skills through mentors.", "true"),
            bool(CAT_FEATURES, "enable_mentor_verification", "Enable Mentor Verification",
                    "Require and process mentor verification requests.", "true"),
            bool(CAT_FEATURES, "mentor_verification_required", "Mentor Verification Required (legacy)",
                    "Legacy toggle retained for backward compatibility with existing deployments.", "true"),
            bool(CAT_FEATURES, "enable_reviews", "Enable Reviews",
                    "Allow ratings and reviews after completed sessions.", "true"),
            bool(CAT_FEATURES, "enable_reports", "Enable Reports",
                    "Allow users to report content and users.", "true"),
            bool(CAT_FEATURES, "enable_chat", "Enable Chat",
                    "Allow in-app messaging between users.", "true"),
            bool(CAT_FEATURES, "enable_notifications", "Enable Notifications",
                    "Global switch for the notification system.", "true"),
            bool(CAT_FEATURES, "enable_analytics", "Enable Analytics",
                    "Collect and display analytics data.", "true"),

            // ── Appearance ──
            def(CAT_APPEARANCE, "default_theme", "select", "Default Theme",
                    "Theme applied to new users.", "light", List.of("light", "dark", "system")),
            def(CAT_APPEARANCE, "accent_color", "select", "Accent Color",
                    "Primary accent color used in the UI.", "indigo",
                    List.of("indigo", "emerald", "sky", "violet", "rose", "amber")),
            def(CAT_APPEARANCE, "default_dashboard_layout", "select", "Default Dashboard Layout",
                    "Initial layout of the user dashboard.", "grid", List.of("grid", "list")),
            def(CAT_APPEARANCE, "default_language", "select", "Default Language",
                    "Fallback language for the UI.", "en", List.of("en", "es", "fr", "de", "hi", "ar", "pt")),

            // ── Maintenance ──
            bool(CAT_MAINTENANCE, "maintenance_mode", "Maintenance Mode",
                    "When enabled, only admins can access the platform.", "false"));

    /**
     * Notification preference keys (admin_notif_preferences) surfaced in the
     * Notifications section. Legacy keys from the original page are retained so
     * existing stored rows and tests keep working alongside the new set.
     */
    public static final Map<String, String> NOTIFICATION_PREFS = new LinkedHashMap<>();
    static {
        NOTIFICATION_PREFS.put("new_user_signups", "New user registration");
        NOTIFICATION_PREFS.put("mentor_verification_request", "Mentor verification request");
        NOTIFICATION_PREFS.put("report_submitted", "Report submitted");
        NOTIFICATION_PREFS.put("content_flagged", "Content flagged");
        NOTIFICATION_PREFS.put("payment_failed", "Payment failed");
        NOTIFICATION_PREFS.put("payment_success", "Payment success");
        NOTIFICATION_PREFS.put("wallet_transactions", "Wallet transactions");
        NOTIFICATION_PREFS.put("session_cancelled", "Session cancelled");
        NOTIFICATION_PREFS.put("session_completed", "Session completed");
        NOTIFICATION_PREFS.put("verification_approved", "Verification approved");
        NOTIFICATION_PREFS.put("verification_rejected", "Verification rejected");
        NOTIFICATION_PREFS.put("system_errors", "System errors");
        NOTIFICATION_PREFS.put("security_alerts", "Security alerts");
        // Legacy keys — kept for backward compatibility with stored prefs and existing tests.
        NOTIFICATION_PREFS.put("reports_filed", "Report filed (legacy)");
        NOTIFICATION_PREFS.put("failed_payments", "Payment failed (legacy)");
        NOTIFICATION_PREFS.put("mentor_verifications", "Mentor verification pending (legacy)");
        NOTIFICATION_PREFS.put("daily_summary", "Daily summary email (legacy)");
        NOTIFICATION_PREFS.put("new_bookings", "New booking created (legacy)");
    }

    // ── Lookup helpers ──────────────────────────────────────────────

    private static final Map<String, SettingDef> BY_KEY = DEFINITIONS.stream()
            .collect(Collectors.toUnmodifiableMap(SettingDef::key, Function.identity()));

    public static Optional<SettingDef> byKey(String key) {
        return Optional.ofNullable(BY_KEY.get(key));
    }

    public static boolean isKnown(String key) {
        return BY_KEY.containsKey(key);
    }

    /** All definitions grouped by category (insertion order preserved). */
    public static Map<String, List<SettingDef>> groupedByCategory() {
        Map<String, List<SettingDef>> grouped = new LinkedHashMap<>();
        for (Category category : CATEGORIES) {
            List<SettingDef> defs = DEFINITIONS.stream()
                    .filter(d -> d.category().equals(category.id()))
                    .toList();
            if (!defs.isEmpty()) {
                grouped.put(category.id(), defs);
            }
        }
        return grouped;
    }

    /** Default value map for every known key — used to seed the GET /settings response. */
    public static Map<String, String> defaults() {
        Map<String, String> defaults = new LinkedHashMap<>();
        for (SettingDef def : DEFINITIONS) {
            defaults.put(def.key(), def.defaultValue());
        }
        return defaults;
    }

    private static SettingDef def(String category, String key, String type, String label,
            String description, String defaultValue) {
        return new SettingDef(key, category, type, label, description, defaultValue, List.of());
    }

    private static SettingDef def(String category, String key, String type, String label,
            String description, String defaultValue, List<String> options) {
        return new SettingDef(key, category, type, label, description, defaultValue, options);
    }

    private static SettingDef bool(String category, String key, String label,
            String description, String defaultValue) {
        return new SettingDef(key, category, "boolean", label, description, defaultValue, List.of("true", "false"));
    }
}
