package com.skillswap.payment;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Map;


/**
 * Encapsulates payment.
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "payments")
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false, unique = true)
    private String orderId;

    @Column(name = "payment_id")
    private String paymentId;

    /**
     * Gateway HMAC signature. Never serialized to clients — it is a secret-ish
     * value used only for server-side verification (webhook / verify flows).
     */
    @JsonIgnore
    @Column(name = "signature")
    private String signature;

    @Column(name = "learner_id", nullable = false)
    private Long learnerId;

    @Column(name = "mentor_id", nullable = false)
    private Long mentorId;

    @Column(name = "session_id", nullable = false)
    private Long sessionId;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Builder.Default
    @Column(nullable = false)
    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    @Builder.Default
    @Column(nullable = false)
    private PaymentStatus status = PaymentStatus.INITIATED;

    @Builder.Default
    @Column(nullable = false)
    private String gateway = "razorpay";

    @Builder.Default
    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    // Transient - not persisted; used to carry gateway response to the controller/serialization
    @Transient
    private Map<String, Object> gatewayResponse;

    public void setGatewayResponse(Map<String, Object> gatewayResponse) {
        this.gatewayResponse = gatewayResponse;
    }

    public Map<String, Object> getGatewayResponse() {
        return gatewayResponse;
    }
}
