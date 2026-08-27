package com.mentorly.wallet;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.mentorly.user.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * Tracks a real-money wallet top-up via Stripe PaymentIntent.
 * <p>
 * This is intentionally separate from {@link com.mentorly.payment.Payment}
 * to keep booking payments and wallet top-ups in distinct tables — the
 * booking payment table has non-nullable mentor/session columns that don't
 * apply here, and many queries filter on the payments table for booking
 * lifecycle logic.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "wallet_top_ups")
public class WalletTopUp {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "order_id", nullable = false, unique = true)
    private String orderId;

    @Builder.Default
    @Column(nullable = false)
    private String gateway = "stripe";

    @Column(name = "stripe_payment_intent_id")
    private String stripePaymentIntentId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    @Column(nullable = false)
    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private WalletTopUpStatus status = WalletTopUpStatus.INITIATED;

    @Builder.Default
    @Column(name = "wallet_credited", nullable = false)
    private boolean walletCredited = false;

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @Builder.Default
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt = OffsetDateTime.now();

    // Transient — carries Stripe client_secret to the frontend
    @JsonIgnore
    @jakarta.persistence.Transient
    private Map<String, Object> gatewayResponse;

    public void setGatewayResponse(Map<String, Object> gatewayResponse) {
        this.gatewayResponse = gatewayResponse;
    }

    public Map<String, Object> getGatewayResponse() {
        return gatewayResponse;
    }
}
