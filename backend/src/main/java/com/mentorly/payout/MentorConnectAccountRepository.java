package com.mentorly.payout;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code MentorConnectAccount} persistence.
 */
public interface MentorConnectAccountRepository extends JpaRepository<MentorConnectAccount, Long> {

    Optional<MentorConnectAccount> findByMentorId(Long mentorId);

    Optional<MentorConnectAccount> findByStripeAccountId(String stripeAccountId);
}
