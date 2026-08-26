package com.mentorly.wallet;

import com.mentorly.common.ApiResponse;
import com.mentorly.common.ProfileCompletionGuard;
import com.mentorly.user.User;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
     */
    @PostMapping("/withdraw")
    public ApiResponse<WalletLedgerEntry> withdraw(@AuthenticationPrincipal User currentUser,
            @Valid @RequestBody WithdrawRequestDTO req) {
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before using your wallet.");
        WalletLedgerEntry entry = walletService.withdraw(currentUser,
                new WalletService.WithdrawRequest(req.amount(), req.description(), req.paymentMethod()));
        return new ApiResponse<>("Withdrawal processed", entry);
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
