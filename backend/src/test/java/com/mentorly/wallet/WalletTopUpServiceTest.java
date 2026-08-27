package com.mentorly.wallet;

import com.mentorly.payment.PaymentGateway;
import com.mentorly.payment.PaymentService;
import com.mentorly.user.User;
import com.mentorly.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletTopUpServiceTest {

    @Mock
    private WalletTopUpRepository topUpRepository;

    @Mock
    private WalletService walletService;

    @Mock
    private PaymentService paymentService;

    @Mock
    private PaymentGateway stripeGateway;

    @InjectMocks
    private WalletTopUpService topUpService;

    @Captor
    private ArgumentCaptor<WalletTopUp> topUpCaptor;

    @Captor
    private ArgumentCaptor<WalletService.WalletEntryRequest> entryCaptor;

    private User learner;
    private User mentor;

    @BeforeEach
    void setUp() {
        learner = new User();
        learner.setId(1L);
        learner.setRole(UserRole.LEARNER);

        mentor = new User();
        mentor.setId(2L);
        mentor.setRole(UserRole.MENTOR);
    }

    // ── createTopUpIntent() ─────────────────────────────

    @Test
    void createTopUpIntentSuccess() {
        when(paymentService.resolveGateway("stripe")).thenReturn(stripeGateway);
        Map<String, Object> gatewayResponse = new HashMap<>();
        gatewayResponse.put("id", "pi_test_123");
        gatewayResponse.put("client_secret", "cs_test_123");
        when(stripeGateway.createOrder(anyString(), eq(new BigDecimal("50.00")), eq("INR")))
                .thenReturn(gatewayResponse);
        when(topUpRepository.save(any())).thenAnswer(inv -> {
            WalletTopUp t = inv.getArgument(0);
            t.setId(1L);
            return t;
        });

        WalletTopUp result = topUpService.createTopUpIntent(learner, new BigDecimal("50.00"));

        assertNotNull(result);
        assertEquals(new BigDecimal("50.00"), result.getAmount());
        assertEquals(WalletTopUpStatus.INITIATED, result.getStatus());
        assertFalse(result.isWalletCredited());
        assertEquals("pi_test_123", result.getStripePaymentIntentId());
        assertTrue(result.getOrderId().startsWith("TOPUP_"));
        verify(topUpRepository).save(any());
    }

    @Test
    void createTopUpIntentRejectsMentor() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(mentor, new BigDecimal("50.00")));
        assertEquals("Only learners can top up their wallet", ex.getMessage());
    }

    @Test
    void createTopUpIntentRejectsNullAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(learner, null));
        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void createTopUpIntentRejectsZeroAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(learner, BigDecimal.ZERO));
        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void createTopUpIntentRejectsBelowMinimum() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(learner, new BigDecimal("5.00")));
        assertTrue(ex.getMessage().contains("Minimum top-up amount"));
    }

    @Test
    void createTopUpIntentAtExactMinimum() {
        when(paymentService.resolveGateway("stripe")).thenReturn(stripeGateway);
        when(stripeGateway.createOrder(anyString(), eq(new BigDecimal("10.00")), eq("INR")))
                .thenReturn(Map.of("id", "pi_test", "client_secret", "cs_test"));
        when(topUpRepository.save(any())).thenAnswer(inv -> {
            WalletTopUp t = inv.getArgument(0);
            t.setId(1L);
            return t;
        });

        WalletTopUp result = topUpService.createTopUpIntent(learner, new BigDecimal("10.00"));

        assertNotNull(result);
        assertEquals(new BigDecimal("10.00"), result.getAmount());
    }

    // ── verifyTopUp() ───────────────────────────────────

    @Test
    void verifyTopUpSuccess() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));
        when(paymentService.resolveGateway("stripe")).thenReturn(stripeGateway);
        when(stripeGateway.verifyPayment("pi_test_123", "TOPUP_TEST123", null, null)).thenReturn(true);
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletService.addEntryForUser(eq(1L), any())).thenReturn(null);

        WalletTopUp result = topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123");

        assertEquals(WalletTopUpStatus.SUCCEEDED, result.getStatus());
        assertTrue(result.isWalletCredited());
        verify(walletService).addEntryForUser(eq(1L), entryCaptor.capture());
        assertEquals(WalletTransactionType.CREDIT, entryCaptor.getValue().type());
        assertEquals(new BigDecimal("100.00"), entryCaptor.getValue().amount());
    }

    @Test
    void verifyTopUpIdempotent() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.SUCCEEDED)
                .walletCredited(true).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));

        WalletTopUp result = topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123");

        assertEquals(WalletTopUpStatus.SUCCEEDED, result.getStatus());
        // Should NOT call wallet service again
        verify(walletService, never()).addEntryForUser(any(), any());
    }

    @Test
    void verifyTopUpRejectsWrongUser() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));

        User otherUser = new User();
        otherUser.setId(99L);
        otherUser.setRole(UserRole.LEARNER);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.verifyTopUp(otherUser, "TOPUP_TEST123", "pi_test_123"));
        assertEquals("You can only verify your own top-up", ex.getMessage());
    }

    @Test
    void verifyTopUpFailsOnStripeVerificationFailure() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));
        when(paymentService.resolveGateway("stripe")).thenReturn(stripeGateway);
        when(stripeGateway.verifyPayment("pi_test_123", "TOPUP_TEST123", null, null)).thenReturn(false);
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(IllegalStateException.class,
                () -> topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123"));

        // Wallet should NOT be credited
        verify(walletService, never()).addEntryForUser(any(), any());
    }

    @Test
    void verifyTopUpRejectsAlreadyFailed() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.FAILED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));

        assertThrows(IllegalStateException.class,
                () -> topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123"));
    }

    @Test
    void verifyTopUpNotFound() {
        when(topUpRepository.findByOrderId("NONEXISTENT")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> topUpService.verifyTopUp(learner, "NONEXISTENT", "pi_test"));
    }

    // ── handleWebhook() ─────────────────────────────────

    @Test
    void handleWebhookCreditsWallet() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_WEBHOOK123")
                .amount(new BigDecimal("200.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_WEBHOOK123")).thenReturn(Optional.of(topUp));
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletService.addEntryForUser(eq(1L), any())).thenReturn(null);

        WalletTopUp result = topUpService.handleWebhook("TOPUP_WEBHOOK123");

        assertEquals(WalletTopUpStatus.SUCCEEDED, result.getStatus());
        assertTrue(result.isWalletCredited());
        verify(walletService).addEntryForUser(eq(1L), entryCaptor.capture());
        assertEquals(WalletTransactionType.CREDIT, entryCaptor.getValue().type());
    }

    @Test
    void handleWebhookIdempotent() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_WEBHOOK123")
                .amount(new BigDecimal("200.00")).status(WalletTopUpStatus.SUCCEEDED)
                .walletCredited(true).build();

        when(topUpRepository.findByOrderId("TOPUP_WEBHOOK123")).thenReturn(Optional.of(topUp));

        WalletTopUp result = topUpService.handleWebhook("TOPUP_WEBHOOK123");

        assertEquals(WalletTopUpStatus.SUCCEEDED, result.getStatus());
        verify(walletService, never()).addEntryForUser(any(), any());
    }
}
