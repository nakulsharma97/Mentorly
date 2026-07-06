package com.skillswap.waitlist;

import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

@Getter
@Setter
@Entity
@Table(name = "session_waitlist")
public class SessionWaitlist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "session_id", nullable = false)
    private SkillSession session;

    @ManyToOne(optional = false)
    @JoinColumn(name = "learner_id", nullable = false)
    private User learner;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WaitlistStatus status = WaitlistStatus.ACTIVE;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();
}
