package com.skillswap.referral;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ReferralRewardRepository extends JpaRepository<ReferralReward, Long> {

    boolean existsByRefereeId(Long refereeId);

    long countByReferrerId(Long referrerId);

    @Query("SELECT DISTINCT r.referrerId FROM ReferralReward r")
    List<Long> findDistinctReferrerIds();

    @Query(value = "SELECT rr.referrer_id, COUNT(*) as cnt FROM referral_rewards rr GROUP BY rr.referrer_id ORDER BY cnt DESC LIMIT 10", nativeQuery = true)
    List<Object[]> findTopReferrersRaw();


}