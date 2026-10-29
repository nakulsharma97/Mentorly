package com.mentorly.auth;

import com.mentorly.config.ClientIpResolver;
import com.mentorly.notification.EmailDeliveryGuard;
import com.mentorly.notification.EmailNotConfiguredException;
import com.mentorly.user.UserRole;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static com.mentorly.auth.AuthDtos.ForgotPasswordRequest;
import static com.mentorly.auth.AuthDtos.SendOtpRequest;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * The 503 gate must run before any signup validation, OTP generation or user
 * lookup, so a misconfigured deployment never writes state it cannot follow
 * through on.
 */
class AuthControllerEmailGuardTest {

    private final AuthService authService = mock(AuthService.class);
    private final AuthCookieService authCookieService = mock(AuthCookieService.class);
    private final ClientIpResolver clientIpResolver = mock(ClientIpResolver.class);
    private final OtpService otpService = mock(OtpService.class);
    private final EmailDeliveryGuard emailDeliveryGuard = mock(EmailDeliveryGuard.class);

    private AuthController controller;

    @BeforeEach
    void setUp() {
        controller = new AuthController(authService, authCookieService, clientIpResolver, otpService,
                emailDeliveryGuard);
        doThrow(new EmailNotConfiguredException()).when(emailDeliveryGuard).requireConfigured();
    }

    @Test
    void sendVerificationOtpIsRejectedBeforeAnyWorkHappens() {
        SendOtpRequest request = new SendOtpRequest("learner@example.com", "Learner One", "learner1",
                "Password1", UserRole.LEARNER, null);

        assertThrows(EmailNotConfiguredException.class,
                () -> controller.sendVerificationOtp(request, mock(HttpServletRequest.class)));

        verifyNoInteractions(authService, otpService, clientIpResolver, authCookieService);
    }

    @Test
    void forgotPasswordIsRejectedBeforeAnyWorkHappens() {
        ForgotPasswordRequest request = new ForgotPasswordRequest("learner@example.com");

        assertThrows(EmailNotConfiguredException.class,
                () -> controller.forgotPassword(request, mock(HttpServletRequest.class)));

        verifyNoInteractions(authService, otpService, clientIpResolver, authCookieService);
    }
}
