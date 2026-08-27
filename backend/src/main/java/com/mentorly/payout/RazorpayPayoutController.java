package com.mentorly.payout;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * REST controller for Razorpay Route / Linked Account mentor onboarding and payout status.
 * Provides the same interface pattern as the existing Stripe Connect controller.
 */
@RestController
@RequestMapping("/api/v1/mentor/razorpay-payout")
@RequiredArgsConstructor
public class RazorpayPayoutController {

    private static final Logger LOG = LoggerFactory.getLogger(RazorpayPayoutController.class);

    private final RazorpayRouteService razorpayRouteService;

    /**
     * Create a Razorpay Linked Account (if needed) and return an onboarding URL.
     */
    @PostMapping("/onboard")
    public ApiResponse<Map<String, String>> onboard(@AuthenticationPrincipal User currentUser) {
        String onboardingUrl = razorpayRouteService.createOnboardingLink(currentUser);
        return new ApiResponse<>("Razorpay onboarding link created", Map.of("url", onboardingUrl));
    }

    /**
     * Get current onboarding/payout status for the logged-in mentor via Razorpay.
     */
    @GetMapping("/status")
    public ApiResponse<Map<String, Object>> getStatus(@AuthenticationPrincipal User currentUser) {
        RazorpayLinkedAccount account = razorpayRouteService.createLinkedAccount(currentUser);
        return new ApiResponse<>("Razorpay payout status fetched", Map.of(
                "razorpayAccountId", account.getRazorpayAccountId(),
                "onboardingStatus", account.getOnboardingStatus().name(),
                "payoutsEnabled", account.isPayoutsEnabled(),
                "activated", account.isActivated()
        ));
    }
}
