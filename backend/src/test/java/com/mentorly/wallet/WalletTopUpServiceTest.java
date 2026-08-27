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
import static org.mockito.ArgumentMatchers.isNull;
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

        WalletTopUp result = topUpService.createTopUpIntent(learner, new BigDecimal("50.00"), "stripe");

        assertNotNull(result);
        assertEquals(new BigDecimal("50.00"), result.getAmount());
        assertEquals(WalletTopUpStatus.INITIATED, result.getStatus());
        assertFalse(result.isWalletCredited());
        // Stripe: gatewayPaymentId = PaymentIntent ID (same as gatewayOrderId)
        assertEquals("pi_test_123", result.getGatewayPaymentId());
        assertEquals("pi_test_123", result.getGatewayOrderId());
        assertTrue(result.getOrderId().startsWith("TOPUP_"));
        verify(topUpRepository).save(any());
    }

    @Test
    void createTopUpIntentRazorpaySetsGatewayPaymentIdNull() {
        PaymentGateway razorpayGateway = mock(PaymentGateway.class);
        when(paymentService.resolveGateway("razorpay")).thenReturn(razorpayGateway);
        Map<String, Object> gatewayResponse = new HashMap<>();
        gatewayResponse.put("id", "order_PAblzC2xcNwKA2");
        gatewayResponse.put("amount", 5000);
        when(razorpayGateway.createOrder(anyString(), eq(new BigDecimal("50.00")), eq("INR")))
                .thenReturn(gatewayResponse);
        when(topUpRepository.save(any())).thenAnswer(inv -> {
            WalletTopUp t = inv.getArgument(0);
            t.setId(1L);
            return t;
        });

        WalletTopUp result = topUpService.createTopUpIntent(learner, new BigDecimal("50.00"), "razorpay");

        assertNotNull(result);
        assertEquals(WalletTopUpStatus.INITIATED, result.getStatus());
        // Razorpay: gatewayOrderId = Razorpay order ID
        assertEquals("order_PAblzC2xcNwKA2", result.getGatewayOrderId());
        // Razorpay: gatewayPaymentId must be NULL at creation (payment ID comes later)
        assertNull(result.getGatewayPaymentId(),
                "gatewayPaymentId must be null for Razorpay at creation — pay_xxx comes from Checkout");
        assertTrue(result.getOrderId().startsWith("TOPUP_"));
    }

    @Test
    void createTopUpIntentRejectsMentor() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(mentor, new BigDecimal("50.00"), "stripe"));
        assertEquals("Only learners can top up their wallet", ex.getMessage());
    }

    @Test
    void createTopUpIntentRejectsNullAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(learner, null, "stripe"));
        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void createTopUpIntentRejectsZeroAmount() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(learner, BigDecimal.ZERO, "stripe"));
        assertEquals("Amount must be greater than zero", ex.getMessage());
    }

    @Test
    void createTopUpIntentRejectsBelowMinimum() {
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> topUpService.createTopUpIntent(learner, new BigDecimal("5.00"), "stripe"));
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

        WalletTopUp result = topUpService.createTopUpIntent(learner, new BigDecimal("10.00"), "stripe");

        assertNotNull(result);
        assertEquals(new BigDecimal("10.00"), result.getAmount());
    }

    // ── verifyTopUp() ───────────────────────────────────

    @Test
    void verifyTopUpSuccess() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .gatewayOrderId("pi_test_123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));
        when(paymentService.resolveGateway("stripe")).thenReturn(stripeGateway);
        // Must pass gatewayOrderId ("pi_test_123"), NOT the internal TOPUP_TEST123
        when(stripeGateway.verifyPayment("pi_test_123", "pi_test_123", null, null)).thenReturn(true);
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletService.addEntryForUser(eq(1L), any())).thenReturn(null);

        WalletTopUp result = topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123", null);

        assertEquals(WalletTopUpStatus.VERIFIED, result.getStatus());
        assertTrue(result.isWalletCredited());
        verify(walletService).addEntryForUser(eq(1L), entryCaptor.capture());
        assertEquals(WalletTransactionType.CREDIT, entryCaptor.getValue().type());
        assertEquals(new BigDecimal("100.00"), entryCaptor.getValue().amount());
    }

    @Test
    void verifyTopUpRazorpayUsesGatewayOrderIdForHmac() {
        // Simulates: top-up created for Razorpay (gatewayPaymentId=null at creation),
        // then learner completes Checkout and sends pay_xxx + signature to /verify.
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_RAZORPAY1")
                .gatewayOrderId("order_PAblzC2xcNwKA2")
                .gatewayPaymentId(null) // null at creation for Razorpay
                .gateway("razorpay")
                .amount(new BigDecimal("500.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        PaymentGateway razorpayGateway = mock(PaymentGateway.class);

        when(topUpRepository.findByOrderId("TOPUP_RAZORPAY1")).thenReturn(Optional.of(topUp));
        when(paymentService.resolveGateway("razorpay")).thenReturn(razorpayGateway);

        // The HMAC verification must use the REAL Razorpay order ID (order_xxx),
        // NOT the internal TOPUP_RAZORPAY1 id.
        when(razorpayGateway.verifyPayment(
                eq("pay_29hdkf7sjdf8"),                    // Razorpay payment ID
                eq("order_PAblzC2xcNwKA2"),                // Razorpay order ID (not TOPUP_RAZORPAY1)
                eq("expected_hmac_signature"),
                isNull()
        )).thenReturn(true);

        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletService.addEntryForUser(eq(1L), any())).thenReturn(null);

        WalletTopUp result = topUpService.verifyTopUp(
                learner, "TOPUP_RAZORPAY1", "pay_29hdkf7sjdf8", "expected_hmac_signature");

        assertEquals(WalletTopUpStatus.VERIFIED, result.getStatus());
        assertTrue(result.isWalletCredited());
        // After verification, gatewayPaymentId should be set to the real payment ID
        assertEquals("pay_29hdkf7sjdf8", result.getGatewayPaymentId());
        // Verify gateway was called with real Razorpay order ID, NOT internal TOPUP_ id
        verify(razorpayGateway).verifyPayment(
                eq("pay_29hdkf7sjdf8"),
                eq("order_PAblzC2xcNwKA2"),  // critical: must be order_xxx, not TOPUP_RAZORPAY1
                eq("expected_hmac_signature"),
                isNull()
        );
        verify(walletService).addEntryForUser(eq(1L), entryCaptor.capture());
        assertEquals(WalletTransactionType.CREDIT, entryCaptor.getValue().type());
    }

    @Test
    void verifyTopUpRazorpayWrongOrderIdRejected() {
        // When the frontend sends a different order_id than what's stored, the
        // gateway.verifyPayment() should fail because the HMAC won't match.
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_RAZORPAY2")
                .gatewayOrderId("order_real_123")
                .gatewayPaymentId(null)
                .gateway("razorpay")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        PaymentGateway razorpayGateway = mock(PaymentGateway.class);

        when(topUpRepository.findByOrderId("TOPUP_RAZORPAY2")).thenReturn(Optional.of(topUp));
        when(paymentService.resolveGateway("razorpay")).thenReturn(razorpayGateway);

        // verifyPayment uses stored gatewayOrderId (order_real_123)
        // which won't match a forged signature for a different order
        when(razorpayGateway.verifyPayment(
                eq("pay_fake"), eq("order_real_123"), eq("bad_sig"), isNull()
        )).thenReturn(false);
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(IllegalStateException.class,
                () -> topUpService.verifyTopUp(learner, "TOPUP_RAZORPAY2", "pay_fake", "bad_sig"));

        // Wallet should NOT be credited
        verify(walletService, never()).addEntryForUser(any(), any());
    }

    @Test
    void verifyTopUpIdempotent() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.SUCCEEDED)
                .walletCredited(true).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));

        WalletTopUp result = topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123", null);

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
                () -> topUpService.verifyTopUp(otherUser, "TOPUP_TEST123", "pi_test_123", null));
        assertEquals("You can only verify your own top-up", ex.getMessage());
    }

    @Test
    void verifyTopUpFailsOnStripeVerificationFailure() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_TEST123")
                .gatewayOrderId("pi_test_123")
                .amount(new BigDecimal("100.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_TEST123")).thenReturn(Optional.of(topUp));
        when(paymentService.resolveGateway("stripe")).thenReturn(stripeGateway);
        // Must pass gatewayOrderId ("pi_test_123"), NOT the internal TOPUP_TEST123
        when(stripeGateway.verifyPayment("pi_test_123", "pi_test_123", null, null)).thenReturn(false);
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThrows(IllegalStateException.class,
                () -> topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123", null));

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
                () -> topUpService.verifyTopUp(learner, "TOPUP_TEST123", "pi_test_123", null));
    }

    @Test
    void verifyTopUpNotFound() {
        when(topUpRepository.findByOrderId("NONEXISTENT")).thenReturn(Optional.empty());

        assertThrows(IllegalArgumentException.class,
                () -> topUpService.verifyTopUp(learner, "NONEXISTENT", "pi_test", null));
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

        WalletTopUp result = topUpService.handleWebhook("TOPUP_WEBHOOK123", "pay_test_123", new BigDecimal("200.00"));

        assertEquals(WalletTopUpStatus.VERIFIED, result.getStatus());
        assertTrue(result.isWalletCredited());
        // Webhook should set the real Razorpay payment ID
        assertEquals("pay_test_123", result.getGatewayPaymentId());
        verify(walletService).addEntryForUser(eq(1L), entryCaptor.capture());
        assertEquals(WalletTransactionType.CREDIT, entryCaptor.getValue().type());
    }

    @Test
    void handleWebhookRazorpaySetsPaymentIdFromWebhook() {
        // Simulates Razorpay webhook arriving for a top-up where gatewayPaymentId
        // was null (Razorpay order created but learner hasn't called /verify yet).
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_WEBHOOK_RZ1")
                .gatewayOrderId("order_PAblzC2xcNwKA2")
                .gatewayPaymentId(null) // null at creation for Razorpay
                .gateway("razorpay")
                .amount(new BigDecimal("1000.00")).status(WalletTopUpStatus.INITIATED)
                .walletCredited(false).build();

        when(topUpRepository.findByOrderId("TOPUP_WEBHOOK_RZ1")).thenReturn(Optional.of(topUp));
        when(topUpRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(walletService.addEntryForUser(eq(1L), any())).thenReturn(null);

        WalletTopUp result = topUpService.handleWebhook(
                "TOPUP_WEBHOOK_RZ1", "pay_abc123xyz", new BigDecimal("1000.00"));

        assertEquals(WalletTopUpStatus.VERIFIED, result.getStatus());
        assertTrue(result.isWalletCredited());
        // The webhook should have set the real Razorpay payment ID
        assertEquals("pay_abc123xyz", result.getGatewayPaymentId());
        verify(walletService).addEntryForUser(eq(1L), entryCaptor.capture());
        assertEquals(new BigDecimal("1000.00"), entryCaptor.getValue().amount());
    }

    @Test
    void handleWebhookIdempotent() {
        WalletTopUp topUp = WalletTopUp.builder()
                .id(1L).user(learner).orderId("TOPUP_WEBHOOK123")
                .amount(new BigDecimal("200.00")).status(WalletTopUpStatus.SUCCEEDED)
                .walletCredited(true).build();

        when(topUpRepository.findByOrderId("TOPUP_WEBHOOK123")).thenReturn(Optional.of(topUp));

        WalletTopUp result = topUpService.handleWebhook("TOPUP_WEBHOOK123", "pay_test_123", new BigDecimal("200.00"));

        assertEquals(WalletTopUpStatus.SUCCEEDED, result.getStatus());
        verify(walletService, never()).addEntryForUser(any(), any());
    }
}
