package com.skillswap.referral;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ReferralRewardRepository extends JpaRepository<ReferralReward, Long> {

    boolean existsByRefereeId(Long refereeId);

    long countByReferrerId(Long referrerId);
}