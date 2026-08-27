package com.mentorly.payout;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code RazorpayLinkedAccount} persistence.
 */
public interface RazorpayLinkedAccountRepository extends JpaRepository<RazorpayLinkedAccount, Long> {

    Optional<RazorpayLinkedAccount> findByMentorId(Long mentorId);

    Optional<RazorpayLinkedAccount> findByRazorpayAccountId(String razorpayAccountId);
}
