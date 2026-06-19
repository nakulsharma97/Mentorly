package com.skillswap.wallet;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/wallet")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;

    @GetMapping("/balance")
    public ApiResponse<WalletService.WalletBalance> balance(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Wallet balance fetched", walletService.balance(currentUser));
    }

    @GetMapping("/ledger")
    public ApiResponse<List<WalletLedgerEntry>> ledger(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Wallet ledger fetched", walletService.history(currentUser));
    }

}
