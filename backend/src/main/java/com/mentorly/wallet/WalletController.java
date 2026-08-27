package com.mentorly.wallet;

import com.mentorly.common.ApiResponse;
import com.mentorly.common.IdempotencyKeySupport;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;

/**
 * REST controller exposing wallet endpoints.
 */
@RestController
@Validated
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final WalletTopUpService walletTopUpService;
    private final ProfileCompletionGuard profileCompletionGuard;

    @GetMapping("/balance")
    public ApiResponse<WalletService.WalletBalance> balance(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Wallet balance fetched", walletService.balance(currentUser));
    }

    @GetMapping("/ledger")
    public ApiResponse<List<WalletLedgerEntry>> ledger(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Wallet ledger fetched", walletService.history(currentUser));
    }

    /**
     * Withdraw funds from the user's wallet balance.
     * Requires an Idempotency-Key header to prevent duplicate transfers.
     */
    @PostMapping("/withdraw")
    public ApiResponse<WalletLedgerEntry> withdraw(@AuthenticationPrincipal User currentUser,
            @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
            @Valid @RequestBody WithdrawRequestDTO req) {
        IdempotencyKeySupport.validate(idempotencyKey);
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before using your wallet.");
        WalletLedgerEntry entry = walletService.withdraw(currentUser,
                new WalletService.WithdrawRequest(req.amount(), req.description(), req.paymentMethod()),
                idempotencyKey);
        return new ApiResponse<>("Withdrawal processed", entry);
    }

    /**
     * Create a wallet top-up intent (Stripe PaymentIntent).
     */
    @PostMapping("/topup/intent")
    public ApiResponse<WalletTopUp> createTopUpIntent(
            @AuthenticationPrincipal User currentUser,
            @RequestHeader("Idempotency-Key") @NotBlank String idempotencyKey,
            @Valid @RequestBody TopUpRequestDTO req) {
        IdempotencyKeySupport.validate(idempotencyKey);
        WalletTopUp topUp = walletTopUpService.createTopUpIntent(currentUser, req.amount(), req.gateway());
        return new ApiResponse<>("Top-up intent created", topUp);
    }

    /**
     * Verify a wallet top-up payment and credit the wallet.
     */
    @PostMapping("/topup/verify")
    public ApiResponse<WalletTopUp> verifyTopUp(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody VerifyTopUpRequestDTO req) {
        WalletTopUp topUp = walletTopUpService.verifyTopUp(
                currentUser, req.orderId(), req.stripePaymentIntentId());
        return new ApiResponse<>("Top-up verified and wallet credited", topUp);
    }

/**
 * Immutable data carrier for top-up request.
 */
    public record TopUpRequestDTO(
            @NotNull(message = "Amount is required")
            @DecimalMin(value = "10.00", message = "Minimum top-up amount is ₹10.00")
            @Digits(integer = 10, fraction = 2)
            BigDecimal amount,
            String gateway) {
    }

/**
 * Immutable data carrier for verify top-up request.
 */
    public record VerifyTopUpRequestDTO(
            @NotBlank(message = "Order ID is required")
            String orderId,
            @NotBlank(message = "Stripe PaymentIntent ID is required")
            String stripePaymentIntentId) {
    }

/**
 * Immutable data carrier for withdraw request.
 */
    public record WithdrawRequestDTO(
            @NotNull(message = "Amount is required")
            @DecimalMin(value = "10.00", message = "Minimum withdrawal amount is ₹10.00")
            @Digits(integer = 10, fraction = 2)
            BigDecimal amount,
            @Size(max = 500)
            String description,
            @Size(max = 100)
            String paymentMethod) {
    }

}
