package com.skillswap.safety;

import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "user_blocks")
public class UserBlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "blocker_id")
    private User blocker;

    @ManyToOne(optional = false)
    @JoinColumn(name = "blocked_id")
    private User blocked;

    @Column(length = 500)
    private String reason;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
