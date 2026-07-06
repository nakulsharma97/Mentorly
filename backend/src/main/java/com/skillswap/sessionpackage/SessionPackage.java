package com.skillswap.sessionpackage;

import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "session_packages")
public class SessionPackage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "mentor_id")
    private User mentor;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "session_count", nullable = false)
    private Integer sessionCount;

    @Column(name = "discount_percent", nullable = false)
    private BigDecimal discountPercent;

    @Column(name = "total_price", nullable = false)
    private BigDecimal totalPrice;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
