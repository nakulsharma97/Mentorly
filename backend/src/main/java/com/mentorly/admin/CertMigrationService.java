package com.mentorly.admin;

import com.mentorly.mentorcertification.MentorCertification;
import com.mentorly.mentorcertification.MentorCertificationRepository;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * One-time migration service that reads the {@code User.certificates} text field
 * (free-text, one-per-line format) and creates structured {@link MentorCertification}
 * entities in the {@code mentor_certifications} table.
 *
 * <p>Each line is parsed as a separate certification. The parser attempts to
 * extract:
 * <ul>
 *   <li><b>Certification name</b> — the part before the first separator</li>
 *   <li><b>Issuing organization</b> — the part after the separator</li>
 *   <li><b>Year</b> — a 4-digit number found anywhere in the line</li>
 * </ul>
 *
 * <p>Users who already have structured certifications are <b>skipped</b> to
 * avoid duplicates. Users with no text-field data are also skipped.
 */
/**
 * Service implementing cert migration business logic.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CertMigrationService {

    private final UserRepository userRepository;
    private final MentorCertificationRepository certificationRepository;

    /**
     * Run the migration for all users who have text-field certifications but no
     * structured ones yet.
     *
     * @return a summary of how many users and certifications were migrated
     */
    @Transactional
    public MigrationResult migrateAll() {
        int usersProcessed = 0;
        int certsCreated = 0;
        int usersSkippedNoText = 0;
        int usersSkippedAlreadyMigrated = 0;
        int parseErrors = 0;

        // Only migrate mentors — learners should not have certifications (they
        // may have stale text data from earlier versions, but we ignore it).
        List<User> candidates = userRepository.findByRole(UserRole.MENTOR);

        for (User user : candidates) {
            String raw = user.getCertificates();
            if (raw == null || raw.trim().isEmpty()) {
                usersSkippedNoText++;
                continue;
            }

            // Skip users who already have structured certifications
            List<MentorCertification> existing = certificationRepository
                    .findByMentorIdOrderByIssueDateDesc(user.getId());
            if (!existing.isEmpty()) {
                usersSkippedAlreadyMigrated++;
                log.info("SKIP userId={} — already has {} structured certs", user.getId(), existing.size());
                continue;
            }

            // Parse and persist
            List<String> lines = parseLines(raw);
            int createdForUser = 0;
            for (String line : lines) {
                try {
                    ParsedCert parsed = parseLine(line);
                    if (parsed == null) {
                        parseErrors++;
                        log.warn("PARSE_FAILED userId={} — unable to parse line: '{}'",
                                user.getId(), truncate(line, 80));
                        continue;
                    }

                    MentorCertification cert = new MentorCertification();
                    cert.setMentor(user);
                    cert.setCertificationName(parsed.name);
                    cert.setIssuingOrganization(parsed.organization);
                    cert.setIssueDate(parsed.issueDate);
                    if (parsed.description != null) {
                        cert.setDescription(parsed.description);
                    }
                    // Use the current timestamp so migrated certs appear at the
                    // top of the list (sorted by issueDate desc, then createdAt desc)
                    cert.setCreatedAt(OffsetDateTime.now());
                    cert.setUpdatedAt(OffsetDateTime.now());

                    certificationRepository.save(cert);
                    createdForUser++;
                    certsCreated++;
                } catch (Exception e) {
                    parseErrors++;
                    log.warn("PARSE_EXCEPTION userId={} — line='{}' error={}",
                            user.getId(), truncate(line, 80), e.getMessage());
                }
            }

            if (createdForUser > 0) {
                usersProcessed++;
                log.info("MIGRATED userId={} — created {} certification(s)", user.getId(), createdForUser);
            }
        }

        MigrationResult result = new MigrationResult(
                usersProcessed,
                certsCreated,
                usersSkippedNoText,
                usersSkippedAlreadyMigrated,
                parseErrors);
        log.info("Migration complete: {}", result);
        return result;
    }

    // ── Parsing ──────────────────────────────────────────────────────────

    /**
     * Split raw text into individual certification lines.
     * Accepts newlines, pipes, semicolons, and asterisks as separators.
     */
    static List<String> parseLines(String raw) {
        if (raw == null) {
            return List.of();
        }
        String[] parts = raw.split("\\r?\\n|\\||;|\\*");
        List<String> result = new ArrayList<>();
        for (String part : parts) {
            String trimmed = part.trim();
            if (!trimmed.isEmpty()) {
                result.add(trimmed);
            }
        }
        return result;
    }

    /**
     * Parse a single certification line into its components.
     * <p>
     * Expected formats (in priority order):
     * <ol>
     *   <li>{@code Name – Organization, 2024}   (em-dash or hyphen-separator)</li>
     *   <li>{@code Name - Organization, 2024}</li>
     *   <li>{@code Name, Organization, 2024}</li>
     *   <li>{@code Name (2024)}</li>
     *   <li>{@code Name}</li>
     * </ol>
     * <p>
     * Returns {@code null} if the line cannot produce a meaningful certification name.
     */
    static ParsedCert parseLine(String line) {
        if (line == null || line.trim().isEmpty()) {
            return null;
        }
        String working = line.trim();

        // Try to extract a 4-digit year anywhere in the string
        Integer year = null;
        java.util.regex.Matcher yearMatcher = java.util.regex.Pattern.compile("\\b(19|20)\\d{2}\\b").matcher(working);
        if (yearMatcher.find()) {
            year = Integer.parseInt(yearMatcher.group());
        }

        // Determine the issue date
        LocalDate issueDate = year != null ? LocalDate.of(year, 1, 1) : LocalDate.of(2000, 1, 1);

        // Attempt 1: split by " – " (em-dash) or " - " (hyphen with spaces)
        String[] parts = working.split("\\s*[–—\\-]\\s*", 2);
        String name;
        String organization;
        String description = null;

        if (parts.length >= 2) {
            name = parts[0].trim();
            String rest = parts[1].trim();

            // Remove trailing year from organization/rest
            rest = rest.replaceAll(",\\s*\\d{4}\\s*$", "").trim();

            // If rest contains a comma, split into org and description
            int commaIdx = rest.indexOf(',');
            if (commaIdx > 0) {
                organization = rest.substring(0, commaIdx).trim();
                String remainder = rest.substring(commaIdx + 1).trim();
                if (!remainder.isEmpty() && !remainder.matches("\\d{4}")) {
                    description = remainder;
                }
            } else {
                organization = rest;
            }
        } else {
            // Attempt 2: split by "," — take first as name, second as org
            String[] commaParts = working.split("\\s*,\\s*", 3);
            if (commaParts.length >= 2) {
                name = commaParts[0].trim();
                organization = commaParts[1].replaceAll("\\s*\\d{4}\\s*$", "").trim();
                if (organization.isEmpty()) {
                    organization = "Unknown Organization";
                }
            } else {
                // Attempt 3: try to extract "(Year)" pattern
                java.util.regex.Matcher parenMatcher = java.util.regex.Pattern
                        .compile("(.+?)\\s*\\((\\d{4})\\)").matcher(working);
                if (parenMatcher.matches()) {
                    name = parenMatcher.group(1).trim();
                    organization = "Unknown Organization";
                } else {
                    // Fallback: entire line is the certification name
                    name = working;
                    organization = "Unknown Organization";
                }
            }
        }

        // Clean up the name
        name = name.replaceAll("\\s*\\d{4}\\s*$", "").trim();
        if (name.isEmpty()) {
            return null;
        }

        return new ParsedCert(name, organization, issueDate, description);
    }

    private static String truncate(String value, int maxLen) {
        if (value == null) {
            return null;
        }
        return value.length() <= maxLen ? value : value.substring(0, maxLen) + "…";
    }

    // ── DTOs ─────────────────────────────────────────────────────────────

/**
 * Immutable data carrier for migration result.
 */
    public record MigrationResult(
            int usersProcessed,
            int certsCreated,
            int usersSkippedNoText,
            int usersSkippedAlreadyMigrated,
            int parseErrors) {

        @Override
        public String toString() {
            return String.format(
                    "MigrationResult{usersProcessed=%d, certsCreated=%d, skippedNoText=%d,"
                            + " skippedAlreadyMigrated=%d, parseErrors=%d}",
                    usersProcessed, certsCreated, usersSkippedNoText, usersSkippedAlreadyMigrated, parseErrors);
        }
    }

    /** Internal parsed representation of a single certification line. */
    record ParsedCert(String name, String organization, LocalDate issueDate, String description) { }
}
