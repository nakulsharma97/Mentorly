package com.skillswap.referral;

import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.wallet.WalletService;
import com.skillswap.wallet.WalletTransactionType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReferralService {

    private static final BigDecimal REFERRAL_CREDITS = BigDecimal.valueOf(50);

    private final UserRepository userRepository;
    private final ReferralRewardRepository referralRewardRepository;
    private final WalletService walletService;

    @Transactional
    public void processReferralReward(Long refereeId, Long bookingId) {
        User referee = userRepository.findById(refereeId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Long referrerId = referee.getReferredByUserId();
        if (referrerId == null || referralRewardRepository.existsByRefereeId(refereeId)) {
            return;
        }

        User referrer = userRepository.findById(referrerId)
                .orElseThrow(() -> new IllegalArgumentException("Referral referrer not found"));

        walletService.addEntryForUser(referrer.getId(), new WalletService.WalletEntryRequest(
                WalletTransactionType.CREDIT,
                REFERRAL_CREDITS,
                "CREDITS",
                "Referral reward: your referral completed their first booking",
                "REFERRAL",
                bookingId));

        walletService.addEntryForUser(referee.getId(), new WalletService.WalletEntryRequest(
                WalletTransactionType.CREDIT,
                REFERRAL_CREDITS,
                "CREDITS",
                "Welcome bonus: you completed your first booking",
                "REFERRAL",
                bookingId));

        ReferralReward reward = new ReferralReward();
        reward.setReferrerId(referrer.getId());
        reward.setRefereeId(referee.getId());
        reward.setBookingId(bookingId);
        referralRewardRepository.save(reward);

        log.info("referral_reward_granted refereeId={} referrerId={} bookingId={}",
                refereeId, referrer.getId(), bookingId);
    }
}