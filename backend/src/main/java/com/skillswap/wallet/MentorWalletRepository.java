package com.skillswap.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Spring Data repository for {@code MentorWallet} persistence.
 */
public interface MentorWalletRepository extends JpaRepository<MentorWallet, Long> {

    Optional<MentorWallet> findByMentorId(Long mentorId);
}
