package com.mentorly.payout;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * REST controller for Stripe Connect mentor onboarding and payout status.
 */
@RestController
@RequestMapping("/api/v1/mentor/connect")
@RequiredArgsConstructor
public class MentorConnectController {

    private final StripeConnectService stripeConnectService;

    /**
     * Create a Stripe Connect Express account (if needed) and return
     * a Stripe-hosted onboarding URL.
     */
    @PostMapping("/onboard")
    public ApiResponse<Map<String, String>> onboard(@AuthenticationPrincipal User currentUser) {
        String onboardingUrl = stripeConnectService.createOnboardingLink(currentUser);
        return new ApiResponse<>("Onboarding link created", Map.of("url", onboardingUrl));
    }

    /**
     * Get current onboarding/payout status for the logged-in mentor.
     */
    @GetMapping("/status")
    public ApiResponse<MentorConnectAccount> getStatus(@AuthenticationPrincipal User currentUser) {
        MentorConnectAccount status = stripeConnectService.getAccountStatus(currentUser);
        return new ApiResponse<>("Payout status fetched", status);
    }
}
