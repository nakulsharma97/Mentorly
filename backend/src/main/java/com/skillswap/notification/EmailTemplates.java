package com.skillswap.notification;

/**
 * Encapsulates email templates.
 */
public final class EmailTemplates {

    private EmailTemplates() {
    }

    public static String bookingCreatedToMentor(
            String mentorName,
            String learnerName,
            String sessionTitle,
            String sessionDate) {
        return "Hi " + safe(mentorName) + ",\n\n"
                + safe(learnerName) + " has requested your session \"" + safe(sessionTitle) + "\".\n"
                + "Session date: " + safe(sessionDate) + "\n\n"
                + "Please review the booking request in your dashboard.\n\n"
                + "- SkillSwap";
    }

    public static String bookingAcceptedToLearner(
            String learnerName,
            String mentorName,
            String sessionTitle,
            String sessionDate) {
        return "Hi " + safe(learnerName) + ",\n\n"
                + "Your booking for \"" + safe(sessionTitle) + "\" has been accepted by " + safe(mentorName)
                + ".\n"
                + "Session date: " + safe(sessionDate) + "\n\n"
                + "You're all set. See you there!\n\n"
                + "- SkillSwap";
    }

    public static String bookingCompletedToLearner(
            String learnerName,
            String mentorName,
            String sessionTitle) {
        return "Hi " + safe(learnerName) + ",\n\n"
                + "Your session \"" + safe(sessionTitle) + "\" with " + safe(mentorName)
                + " has been marked as completed.\n\n"
                + "You can now leave a review in your dashboard.\n\n"
                + "- SkillSwap";
    }

    public static String bookingCancelledToLearner(
            String learnerName,
            String sessionTitle,
            int refundPercent) {
        return "Hi " + safe(learnerName) + ",\n\n"
                + "Your booking for \"" + safe(sessionTitle) + "\" was cancelled.\n"
                + "Refund processed: " + refundPercent + "%.\n\n"
                + "If you need help, please contact support from your dashboard.\n\n"
                + "- SkillSwap";
    }

    public static String mentorVerificationApproved(String mentorName) {
        return "Hi " + safe(mentorName) + ",\n\n"
                + "Great news! Your mentor verification request has been approved.\n"
                + "Your mentor profile is now marked as verified.\n\n"
                + "- SkillSwap";
    }

    public static String mentorVerificationRejected(String mentorName, String reason) {
        return "Hi " + safe(mentorName) + ",\n\n"
                + "Your mentor verification request was rejected.\n"
                + "Reason: " + safe(reason) + "\n\n"
                + "Please update your submission and try again.\n\n"
                + "- SkillSwap";
    }

    private static String safe(String value) {
        return value == null || value.isBlank() ? "there" : value;
    }
}
