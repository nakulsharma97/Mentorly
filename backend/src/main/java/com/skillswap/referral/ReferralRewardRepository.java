package com.skillswap.referral;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

/**
 * Spring Data repository for {@code ReferralReward} persistence.
 */
public interface ReferralRewardRepository extends JpaRepository<ReferralReward, Long> {

    boolean existsByRefereeId(Long refereeId);

    long countByReferrerId(Long referrerId);

    @Query("SELECT DISTINCT r.referrerId FROM ReferralReward r")
    List<Long> findDistinctReferrerIds();

    @Query(value = "SELECT rr.referrer_id, COUNT(*) as cnt FROM referral_rewards rr"
            + " GROUP BY rr.referrer_id ORDER BY cnt DESC LIMIT 10", nativeQuery = true)
    List<Object[]> findTopReferrersRaw();

    @Query("SELECT FUNCTION('YEAR', r.rewardedAt), FUNCTION('MONTH', r.rewardedAt), COUNT(r)"
            + " FROM ReferralReward r WHERE r.rewardedAt IS NOT NULL"
            + " GROUP BY FUNCTION('YEAR', r.rewardedAt), FUNCTION('MONTH', r.rewardedAt) ORDER BY 1, 2")
    List<Object[]> countByMonth();
}
