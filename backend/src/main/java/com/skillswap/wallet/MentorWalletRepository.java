package com.skillswap.wallet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MentorWalletRepository extends JpaRepository<MentorWallet, Long> {

    Optional<MentorWallet> findByMentorId(Long mentorId);
}
