package com.skillswap.common;

import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Predicate;

/**
 * THE single source of truth for profile completion.
 *
 * <p>Every surface — the onboarding form, dashboards, profile pages, admin
 * views and verification eligibility — computes completion through this
 * service, so the percentage, the required sections and the
 * {@code profileCompleted} flag are always identical across the product.
 * The percentage is ALWAYS derived dynamically from the actual filled
 * fields; it is never hardcoded.
 *
 * <p><b>Mentor</b> completion is 5 sections × 20%:
 * Basic Information · Skills &amp; Pricing · Experience · Portfolio &amp; Links ·
 * Contact &amp; Location.
 *
 * <p><b>Learner</b> completion is 4 sections × 25%:
 * Basic Information · Skills &amp; Goals · Learning Goals · Contact &amp; Location.
 */
@Service
public class ProfileCompletionService {

    private static final Logger log = LoggerFactory.getLogger(ProfileCompletionService.class);

    /** A single required field with its human label and fill test. */
    public record FieldCheck(String key, String label, Predicate<User> filled) {
    }

    /** A named section grouping several required fields. */
    public record SectionDef(String key, String label, List<FieldCheck> fields) {
    }

    /** Per-section status for checklist rendering (all sections sum to 100). */
    public record SectionStatus(String key, String label, int filled, int required, boolean done) {
    }

    /** Full completion result: percentage, flag, missing keys and section detail. */
    public record Result(int percent, boolean complete, List<String> missing, List<SectionStatus> sections) {
    }

    private static final List<SectionDef> MENTOR_SECTIONS = List.of(
            new SectionDef("basic", "Basic Information", List.of(
                    new FieldCheck("fullName", "Full Name", u -> hasValue(u.getFullName())),
                    new FieldCheck("profileImageUrl", "Profile Picture", u -> hasValue(u.getProfileImageUrl())),
                    new FieldCheck("aboutMe", "About Yourself", u -> hasValue(u.getAboutMe())))),
            new SectionDef("skills", "Skills & Pricing", List.of(
                    new FieldCheck("skills", "Skills", u -> hasValue(u.getSkills())),
                    new FieldCheck("languages", "Languages", u -> hasValue(u.getLanguages())),
                    new FieldCheck("education", "Education", u -> hasValue(u.getEducation())),
                    // ₹0 is valid — free mentoring sessions.
                    new FieldCheck("hourlyRate", "Hourly Rate", u ->
                            u.getHourlyRate() != null && u.getHourlyRate().signum() >= 0))),
            new SectionDef("experience", "Experience", List.of(
                    // 0 years is valid — a fresher may become a mentor once approved.
                    new FieldCheck("yearsOfExperience", "Experience", u ->
                            u.getYearsOfExperience() != null && u.getYearsOfExperience() >= 0))),
            new SectionDef("portfolio", "Portfolio & Links", List.of(
                    // LinkedIn OR portfolio / GitHub / personal website — at least one.
                    new FieldCheck("portfolio", "Portfolio / Links", u ->
                            hasValue(u.getLinkedinUrl())
                                    || hasValue(u.getPortfolioUrl())
                                    || hasValue(u.getGithubUrl())
                                    || hasValue(u.getProjects())))),
            new SectionDef("contact", "Contact & Location", List.of(
                    new FieldCheck("country", "Country", u -> hasValue(u.getCountry())),
                    new FieldCheck("state", "State / Province", u -> hasValue(u.getState())),
                    new FieldCheck("city", "City", u -> hasValue(u.getCity())),
                    new FieldCheck("timezone", "Timezone", u -> hasValue(u.getTimezone())),
                    new FieldCheck("availability", "Availability", u -> hasValue(u.getAvailability())))));

    private static final List<SectionDef> LEARNER_SECTIONS = List.of(
            new SectionDef("basic", "Basic Information", List.of(
                    new FieldCheck("fullName", "Full Name", u -> hasValue(u.getFullName())),
                    new FieldCheck("profileImageUrl", "Profile Picture", u -> hasValue(u.getProfileImageUrl())),
                    new FieldCheck("aboutMe", "About Yourself", u -> hasValue(u.getAboutMe())))),
            new SectionDef("skills", "Skills & Goals", List.of(
                    new FieldCheck("skills", "Skills", u -> hasValue(u.getSkills())),
                    new FieldCheck("currentSkillLevel", "Skill Level", u -> hasValue(u.getCurrentSkillLevel())),
                    new FieldCheck("languages", "Languages", u -> hasValue(u.getLanguages())))),
            new SectionDef("goals", "Learning Goals", List.of(
                    new FieldCheck("learningGoals", "Learning Goals", u -> hasValue(u.getLearningGoals())))),
            new SectionDef("contact", "Contact & Location", List.of(
                    new FieldCheck("country", "Country", u -> hasValue(u.getCountry())),
                    new FieldCheck("state", "State / Province", u -> hasValue(u.getState())),
                    new FieldCheck("city", "City", u -> hasValue(u.getCity())),
                    new FieldCheck("timezone", "Timezone", u -> hasValue(u.getTimezone())),
                    new FieldCheck("phoneNumber", "Phone Number", u -> hasValue(u.getPhoneNumber())))));

    /**
     * Computes the completion percentage + missing fields + per-section detail
     * from the ACTUAL filled profile fields. Admins are always 100%.
     * Static so it can be reused by pure factory methods (e.g. DTO builders).
     */
    public static Result compute(User user) {
        if (user == null || user.getRole() == UserRole.ADMIN) {
            return new Result(100, true, List.of(), List.of());
        }
        List<SectionDef> sections = user.getRole() == UserRole.MENTOR ? MENTOR_SECTIONS : LEARNER_SECTIONS;
        int weightPerSection = 100 / sections.size();

        List<String> missing = new ArrayList<>();
        List<SectionStatus> statuses = new ArrayList<>();
        double total = 0;
        for (SectionDef section : sections) {
            int required = section.fields().size();
            int filled = 0;
            for (FieldCheck check : section.fields()) {
                if (check.filled().test(user)) {
                    filled++;
                } else {
                    missing.add(check.key());
                }
            }
            statuses.add(new SectionStatus(section.key(), section.label(), filled, required, filled == required));
            total += weightPerSection * (filled / (double) required);
        }
        int percent = Math.min(100, Math.round((float) total));
        return new Result(percent, percent >= 100, missing, statuses);
    }

    /** Convenience predicate — 100% complete. */
    public boolean isComplete(User user) {
        return compute(user).complete();
    }

    /**
     * Keeps the persisted {@code profileCompleted} flag permanently in sync
     * with the dynamic calculation: true exactly when every required section
     * is filled. Call after any profile mutation.
     */
    public void sync(User user) {
        if (user == null || user.getRole() == UserRole.ADMIN) {
            return;
        }
        Result result = compute(user);
        if (user.isProfileCompleted() != result.complete()) {
            user.setProfileCompleted(result.complete());
            log.info("profile_completion_sync userId={} percent={} completed={}",
                    user.getId(), result.percent(), result.complete());
        }
    }

    private static boolean hasValue(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
