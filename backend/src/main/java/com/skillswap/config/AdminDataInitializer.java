package com.skillswap.config;

import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Seeds the single designated admin user on application startup if the
 * {@code app.admin.email} property is configured and no admin user exists yet.
 * <p>
 * Only one admin user is ever allowed in the system — signups with
 * {@code UserRole.ADMIN} are rejected in {@code AuthService}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AdminDataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.admin.email:}")
    private String adminEmail;

    @Value("${app.admin.password:}")
    private String adminPassword;

    @Value("${app.admin.name:Platform Admin}")
    private String adminName;

    @Value("${spring.profiles.active:}")
    private String activeProfiles;

    /**
     * Known default/placeholder admin passwords. In any non-development
     * profile the initializer refuses to seed the admin account with one of
     * these — a production deploy must supply its own strong credential.
     * Comparison is case-insensitive so variants like {@code admin@12345}
     * or {@code ADMIN} cannot slip past the guard.
     */
    private static final java.util.Set<String> INSECURE_ADMIN_PASSWORDS =
            java.util.Set.of("Admin@12345", "admin", "password", "changeme", "admin123");

    private static boolean isInsecurePassword(String password) {
        String normalized = password == null ? "" : password.trim().toLowerCase(java.util.Locale.ROOT);
        return INSECURE_ADMIN_PASSWORDS.stream()
                .anyMatch(p -> p.toLowerCase(java.util.Locale.ROOT).equals(normalized));
    }

    @Override
    public void run(String... args) {
        if (adminEmail == null || adminEmail.isBlank()) {
            log.info("AdminDataInitializer skipped — no app.admin.email configured");
            return;
        }

        // Check if an admin user already exists in the system
        var admins = userRepository.findByRole(UserRole.ADMIN);
        boolean adminExists = admins.stream().anyMatch(User::isEnabled);

        if (adminExists) {
            log.info("AdminDataInitializer — ensuring only one admin user");
            boolean foundConfigured = false;
            for (User admin : admins) {
                if (admin.getEmail().equalsIgnoreCase(adminEmail.trim())) {
                    foundConfigured = true;
                    // Don't re-hash the password — it was set on initial creation.
                    // Password changes should go through the normal password-reset flow.
                    admin.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
                    admin.setEnabled(true);
                    userRepository.save(admin);
                } else {
                    // Demote any extra admin users to LEARNER
                    log.warn("Demoting extra admin user {} ({}) to LEARNER — only one admin allowed",
                            admin.getId(), admin.getEmail());
                    admin.setRole(UserRole.LEARNER);
                    admin.setAdminSubRole(null);
                    admin.setEnabled(true);
                    userRepository.save(admin);
                }
            }
            if (!foundConfigured) {
                // The configured admin email doesn't match any existing admin.
                // If there's already an enabled admin in the system, do NOT create another one.
                // Instead, inform via log that the configured admin email was not matched.
                log.warn("Configured admin email '{}' does not match any existing admin. " +
                        "An admin already exists in the system. Skipping creation.", adminEmail);
            }
            return;
        }

        // No admin exists yet — check if the configured admin email is an existing user
        var existingUserOpt = userRepository.findByEmail(adminEmail.trim().toLowerCase());
        if (existingUserOpt.isPresent()) {
            User existing = existingUserOpt.get();
            existing.setRole(UserRole.ADMIN);
            existing.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
            // Don't overwrite the existing user's password — the configured
            // admin password is only used when creating the admin from scratch.
            existing.setEnabled(true);
            userRepository.save(existing);
            log.info("Promoted existing user {} to admin role — password unchanged", adminEmail);
        } else {
            createAdminUser();
        }
    }

    private void createAdminUser() {
        if (adminPassword == null || adminPassword.isBlank()) {
            if (isProductionLikeProfile()) {
                throw new IllegalStateException(
                        "Refusing to start: APP_ADMIN_PASSWORD is not configured but the application "
                                + "is running in a non-development profile. Set a strong unique "
                                + "APP_ADMIN_PASSWORD before deploying.");
            }
            log.warn("AdminDataInitializer skipped creating admin — app.admin.password is not configured");
            return;
        }

        String password = adminPassword.trim();
        if (isProductionLikeProfile() && isInsecurePassword(password)) {
            throw new IllegalStateException(
                    "Refusing to start: APP_ADMIN_PASSWORD uses a known default value ('" + password
                            + "') in a non-development profile. Set a strong unique APP_ADMIN_PASSWORD "
                            + "before deploying.");
        }
        if (!isProductionLikeProfile() && isInsecurePassword(password)) {
            log.warn("AdminDataInitializer creating admin with a known default password — "
                    + "only acceptable for local development. Use a strong password in any real environment.");
        }

        User admin = new User();
        admin.setEmail(adminEmail.trim().toLowerCase());
        admin.setUsername(generateUsernameFromEmail(adminEmail.trim()));
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setFullName(adminName.trim());
        admin.setRole(UserRole.ADMIN);
        admin.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
        admin.setReferralCode(generateReferralCode());
        admin.setEnabled(true);
        admin.setCreatedAt(OffsetDateTime.now());
        admin.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(admin);
        log.info("Created default admin user: {} (username: {})", adminEmail, admin.getDisplayUsername());
    }

    /**
     * True when the active Spring profiles do not include any local/test/dev
     * profile — i.e. we are (likely) running in a real deployment.
     */
    private boolean isProductionLikeProfile() {
        if (activeProfiles == null || activeProfiles.isBlank()) {
            // No profile is active — treat as non-production so local runs with
            // defaults are not blocked; the default is dev in application.yml.
            return false;
        }
        String normalized = activeProfiles.toLowerCase(java.util.Locale.ROOT);
        return !normalized.contains("dev")
                && !normalized.contains("local")
                && !normalized.contains("test");
    }

    private static String generateReferralCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    /**
     * Derives a unique, valid username from the admin's email address.
     * Falls back to "admin" with an increasing suffix if the base name
     * is reserved or already taken (though the latter shouldn't happen
     * for a fresh admin creation).
     */
    private String generateUsernameFromEmail(String email) {
        String base = email.contains("@") ? email.substring(0, email.indexOf('@')) : "admin";
        base = base.toLowerCase(java.util.Locale.ROOT).replaceAll("[^a-z0-9_]", "_");
        if (base.length() < 3) base = base + "admin";
        if (base.length() > 20) base = base.substring(0, 20);

        // Check if the generated username is reserved or already taken
        String candidate = base;
        int suffix = 1;
        while (isReservedUsername(candidate) || userRepository.existsByUsername(candidate)) {
            String suffixed = base + suffix;
            candidate = suffixed.length() > 20 ? suffixed.substring(0, 20) : suffixed;
            suffix++;
            if (suffix > 99) {
                // Fallback: use timestamp as last resort
                candidate = "admin" + System.currentTimeMillis() % 100000;
                candidate = candidate.length() > 20 ? candidate.substring(0, 20) : candidate;
                break;
            }
        }
        return candidate;
    }

    private static boolean isReservedUsername(String username) {
        return java.util.Set.of(
                "admin", "support", "login", "register", "signup", "mentor", "learner",
                "settings", "profile", "api", "root", "system", "skillswap", "skillswapper",
                "moderator", "help", "info", "mail", "noreply", "test", "null", "undefined"
        ).contains(username);
    }
}
