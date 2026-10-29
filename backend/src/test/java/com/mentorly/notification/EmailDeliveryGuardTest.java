package com.mentorly.notification;

import com.mentorly.common.ApiResponse;
import com.mentorly.common.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * A5: an endpoint that must deliver a code has to refuse with HTTP 503 when
 * email is disabled outside dev/local, instead of reporting a fake success.
 */
class EmailDeliveryGuardTest {

    private static MockEnvironment environmentWith(String... profiles) {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles(profiles);
        return env;
    }

    @Test
    void disabledEmailInProdIsRejected() {
        EmailDeliveryGuard guard = new EmailDeliveryGuard(false, environmentWith("prod"));

        EmailNotConfiguredException ex = assertThrows(EmailNotConfiguredException.class, guard::requireConfigured);
        assertEquals("Email service is not configured.", ex.getMessage());
    }

    @Test
    void disabledEmailInAnyNonDevelopmentProfileIsRejected() {
        assertThrows(EmailNotConfiguredException.class,
                () -> new EmailDeliveryGuard(false, environmentWith("staging")).requireConfigured());
        assertThrows(EmailNotConfiguredException.class,
                () -> new EmailDeliveryGuard(false, environmentWith("prod", "metrics")).requireConfigured());
    }

    @Test
    void disabledEmailInDevLocalOrTestKeepsTheLogOnlyBehaviour() {
        assertDoesNotThrow(() -> new EmailDeliveryGuard(false, environmentWith("dev")).requireConfigured());
        assertDoesNotThrow(() -> new EmailDeliveryGuard(false, environmentWith("local")).requireConfigured());
        assertDoesNotThrow(() -> new EmailDeliveryGuard(false, environmentWith("test")).requireConfigured());
        // No profile at all (plain `mvn spring-boot:run`, unit tests).
        assertDoesNotThrow(() -> new EmailDeliveryGuard(false, environmentWith()).requireConfigured());
    }

    @Test
    void enabledEmailIsAlwaysAllowed() {
        assertDoesNotThrow(() -> new EmailDeliveryGuard(true, environmentWith("prod")).requireConfigured());
    }

    @Test
    void guardedEndpointResponds503WithTheConfiguredMessage() throws Exception {
        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new GuardedEndpoint(new EmailDeliveryGuard(false, environmentWith("prod"))))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/test/send-code"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.message").value("Email service is not configured."))
                .andExpect(jsonPath("$.data.error").value("Email service is not configured."))
                .andExpect(jsonPath("$.data.code").value("EMAIL_NOT_CONFIGURED"));
    }

    @Test
    void guardedEndpointSucceedsWhenEmailIsConfigured() throws Exception {
        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new GuardedEndpoint(new EmailDeliveryGuard(true, environmentWith("prod"))))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        mvc.perform(post("/test/send-code"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Verification code sent"));
    }

    /** Mirrors AuthController's OTP/password-reset endpoints: guard first, then work. */
    @RestController
    static class GuardedEndpoint {

        private final EmailDeliveryGuard guard;

        GuardedEndpoint(EmailDeliveryGuard guard) {
            this.guard = guard;
        }

        @PostMapping("/test/send-code")
        ApiResponse<Void> sendCode() {
            guard.requireConfigured();
            return new ApiResponse<>("Verification code sent", null);
        }
    }
}
