package com.mentorly.wallet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface WalletTopUpRepository extends JpaRepository<WalletTopUp, Long> {

    Optional<WalletTopUp> findByOrderId(String orderId);

    Optional<WalletTopUp> findByStripePaymentIntentId(String stripePaymentIntentId);

    @Query("SELECT w FROM WalletTopUp w WHERE w.user.id = :userId AND w.orderId = :orderId")
    Optional<WalletTopUp> findByUserIdAndOrderId(
            @Param("userId") Long userId, @Param("orderId") String orderId);
}
