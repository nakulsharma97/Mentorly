package com.skillswap.web3;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

@Service
@RequiredArgsConstructor
public class BlockchainService {

    @Value("${app.polygon.rpc-url}")
    private String polygonRpcUrl;

    public TxVerificationResult verifyTransaction(String txHash) {
        try (Web3j web3j = Web3j.build(new HttpService(polygonRpcUrl))) {
            var receipt = web3j.ethGetTransactionReceipt(txHash).send().getTransactionReceipt();
            if (receipt.isEmpty()) {
                return new TxVerificationResult(false, "Transaction not mined yet", txHash);
            }
            var blockNumber = receipt.get().getBlockNumber();
            var status = receipt.get().getStatus();
            boolean success = "0x1".equalsIgnoreCase(status);
            return new TxVerificationResult(success, "Transaction found on Polygon", txHash, blockNumber.toString(),
                    status);
        } catch (Exception ex) {
            return new TxVerificationResult(false, "Verification failed: " + ex.getMessage(), txHash);
        }
    }

    public record TxVerificationResult(boolean success, String message, String txHash, String blockNumber,
            String status) {
        public TxVerificationResult(boolean success, String message, String txHash) {
            this(success, message, txHash, null, null);
        }
    }
}
