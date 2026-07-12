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
                // The configured admin email doesn't match any existing admin — create them
                createAdminUser();
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
            log.warn("AdminDataInitializer skipped creating admin — app.admin.password is not configured");
            return;
        }

        User admin = new User();
        admin.setEmail(adminEmail.trim().toLowerCase());
        admin.setPasswordHash(passwordEncoder.encode(adminPassword.trim()));
        admin.setFullName(adminName.trim());
        admin.setRole(UserRole.ADMIN);
        admin.setAdminSubRole(AdminSubRole.SUPER_ADMIN);
        admin.setReferralCode(generateReferralCode());
        admin.setEnabled(true);
        admin.setCreatedAt(OffsetDateTime.now());
        admin.setLastActiveAt(OffsetDateTime.now());
        userRepository.save(admin);
        log.info("Created default admin user: {}", adminEmail);
    }

    private static String generateReferralCode() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }
}
