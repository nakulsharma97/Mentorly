package com.mentorly.wallet;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.mentorly.notification.EmailNotificationService;
import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import com.mentorly.user.UserRole;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

/**
 * Regression test for the ambiguous wallet balance read.
 *
 * <p>{@code wallet_ledger_entries.created_at} is {@code TIMESTAMP} (no
 * fractional seconds) in MySQL, while the entity writes
 * {@code OffsetDateTime.now()} with nanosecond precision — so two ledger rows
 * written within the same second land on an identical timestamp. The old
 * queries ordered by {@code created_at} alone, leaving the database free to
 * return either row first: {@code balance()} could then read a stale
 * {@code balance_after} (letting a user withdraw money they no longer had) and
 * {@code history()} could render the newest entry in the middle of the list.
 *
 * <p>Both queries now break the tie on the AUTO_INCREMENT {@code id}, which is
 * monotonic insertion order. This test pins identical timestamps on purpose,
 * the way MySQL would store them.
 */
@SpringBootTest
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:wallet-tiebreak-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=sa",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.flyway.enabled=false",
        "app.jwt.secret=VGhpc0lzQVRlc3RTZWNyZXRLZXlGb3JKV1RBbmRUZXN0aW5nMTIzNDU2Nzg5MA==",
        "app.jwt.expiration-ms=3600000",
        "app.jwt.refresh-expiration-ms=604800000",
        "app.auth.cookies.secure=false",
        "app.oauth2.redirect-url=http://localhost:5174/auth/callback",
        "app.polygon.rpc-url=http://localhost:8545"
})
@Transactional
@Rollback
class WalletBalanceTieBreakTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @Autowired
    private WalletService walletService;

    @Autowired
    private WalletLedgerEntryRepository ledgerRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Test
    void balanceReadsTheNewestRowWhenTimestampsCollide() {
        User user = createUser();
        // Second precision — exactly what MySQL stores for both rows.
        OffsetDateTime sameSecond = OffsetDateTime.now().truncatedTo(ChronoUnit.SECONDS);

        WalletLedgerEntry first = entry(user, new BigDecimal("100.00"), new BigDecimal("100.00"),
                sameSecond, WalletTransactionType.EARNING, "Session payout");
        WalletLedgerEntry second = entry(user, new BigDecimal("-40.00"), new BigDecimal("60.00"),
                sameSecond, WalletTransactionType.DEBIT, "Wallet adjustment");

        assertTrue(second.getId() > first.getId(), "precondition: the second write has the higher id");

        // The wallet must read the row that was written LAST (60.00), not the
        // row that merely sorts equal (100.00).
        BigDecimal balance = walletService.balance(user).balance();
        assertEquals(0, new BigDecimal("60.00").compareTo(balance),
                "balance must come from the newest ledger row even when both "
                        + "rows share a created_at second");

        // History must stay newest-first under the same collision.
        List<WalletLedgerEntry> history = walletService.history(user);
        assertEquals(2, history.size());
        assertEquals(second.getId(), history.get(0).getId(),
                "history must list the newest entry first when timestamps tie");
        assertEquals(first.getId(), history.get(1).getId());
    }

    @Test
    void balanceIsZeroForAUserWithNoEntries() {
        User user = createUser();
        assertEquals(0, BigDecimal.ZERO.compareTo(walletService.balance(user).balance()));
        assertTrue(walletService.history(user).isEmpty());
    }

    // ── Helpers ────────────────────────────────────────────────────────

    private WalletLedgerEntry entry(User user, BigDecimal amount, BigDecimal balanceAfter,
            OffsetDateTime createdAt, WalletTransactionType type, String description) {
        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setUser(user);
        entry.setType(type);
        entry.setAmount(amount);
        entry.setBalanceAfter(balanceAfter);
        entry.setCurrency("INR");
        entry.setDescription(description);
        entry.setCreatedAt(createdAt);
        return ledgerRepository.saveAndFlush(entry);
    }

    private User createUser() {
        User user = new User();
        user.setEmail("wallet+" + UUID.randomUUID() + "@example.com");
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(UserRole.LEARNER);
        user.setUsername("wallet" + UUID.randomUUID().toString().substring(0, 6));
        user.setFullName("Wallet Tester");
        user.setEnabled(true);
        user.setProfileCompleted(true);
        return userRepository.save(user);
    }
}
