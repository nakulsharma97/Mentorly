package com.skillswap.payment;

import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "payment_idempotency_keys", uniqueConstraints = @UniqueConstraint(name = "uk_payment_idempotency", columnNames = {
        "user_id", "endpoint", "idempotency_key" }))
public class PaymentIdempotencyKey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private User user;

    @Column(nullable = false, length = 120)
    private String endpoint;

    @Column(name = "idempotency_key", nullable = false, length = 120)
    private String idempotencyKey;

    @Column(name = "request_hash", nullable = false)
    private String requestHash;

    @ManyToOne
    @JoinColumn(name = "payment_id")
    private Payment payment;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
