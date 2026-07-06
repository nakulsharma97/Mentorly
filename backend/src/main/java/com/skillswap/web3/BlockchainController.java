package com.skillswap.web3;

import com.skillswap.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/blockchain")
@RequiredArgsConstructor
public class BlockchainController {

    private final BlockchainService blockchainService;

    @GetMapping("/tx/{txHash}")
    public ApiResponse<BlockchainService.TxVerificationResult> verify(@PathVariable String txHash) {
        return new ApiResponse<>("Blockchain transaction verification", blockchainService.verifyTransaction(txHash));
    }
}
