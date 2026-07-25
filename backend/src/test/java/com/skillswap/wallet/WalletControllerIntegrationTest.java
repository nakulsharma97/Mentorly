package com.skillswap.wallet;

import com.skillswap.config.CsrfCookieFilter;
import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
import com.skillswap.config.MaintenanceModeFilter;
import com.skillswap.config.RequestTraceFilter;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.math.BigDecimal;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(WalletController.class)
@AutoConfigureMockMvc(addFilters = false)
class WalletControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private WalletService walletService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;

    @MockitoBean
    private RequestTraceFilter requestTraceFilter;

    @MockitoBean
    private MaintenanceModeFilter maintenanceModeFilter;

    @MockitoBean
    private CsrfCookieFilter csrfCookieFilter;

    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    private User createUser(Long id, UserRole role) {
        User user = new User();
        user.setId(id);
        user.setRole(role);
        return user;
    }

    private void setSecurityContext(User user) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
        SecurityContextHolder.setContext(context);
    }

    // ── GET /balance ─────────────────────────────────────

    @Test
    void balanceReturnsOk() throws Exception {
        User learner = createUser(10L, UserRole.LEARNER);
        setSecurityContext(learner);

        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(new BigDecimal("250.00"), "CREDITS"));

        try {
            mockMvc.perform(get("/api/v1/wallet/balance")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Wallet balance fetched"))
                    .andExpect(jsonPath("$.data.balance").value(250.00))
                    .andExpect(jsonPath("$.data.currency").value("CREDITS"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void balanceReturnsZeroForNewUser() throws Exception {
        User learner = createUser(11L, UserRole.LEARNER);
        setSecurityContext(learner);

        when(walletService.balance(any(User.class)))
                .thenReturn(new WalletService.WalletBalance(BigDecimal.ZERO, "CREDITS"));

        try {
            mockMvc.perform(get("/api/v1/wallet/balance")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.data.balance").value(0));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ── GET /ledger ──────────────────────────────────────

    @Test
    void ledgerReturnsOk() throws Exception {
        User learner = createUser(12L, UserRole.LEARNER);
        setSecurityContext(learner);

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(1L);
        entry.setType(WalletTransactionType.EARNING);
        entry.setAmount(new BigDecimal("50.00"));
        entry.setBalanceAfter(new BigDecimal("150.00"));
        entry.setCurrency("CREDITS");
        entry.setDescription("Session earnings");
        entry.setReferenceType("BOOKING");
        entry.setReferenceId(88L);

        when(walletService.history(any(User.class))).thenReturn(List.of(entry));

        try {
            mockMvc.perform(get("/api/v1/wallet/ledger")
                            .contentType(MediaType.APPLICATION_JSON))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Wallet ledger fetched"))
                    .andExpect(jsonPath("$.data[0].id").value(1))
                    .andExpect(jsonPath("$.data[0].type").value("EARNING"))
                    .andExpect(jsonPath("$.data[0].description").value("Session earnings"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ── POST /withdraw — validation failures ─────────────

    @Test
    void withdrawRejectsAmountBelowMinimum() throws Exception {
        User learner = createUser(20L, UserRole.LEARNER);
        setSecurityContext(learner);

        // DTO validation should reject before reaching the service
        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": 5.00,
                                      "description": "Small withdrawal",
                                      "paymentMethod": "Bank Transfer"
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void withdrawRejectsZeroAmount() throws Exception {
        User learner = createUser(21L, UserRole.LEARNER);
        setSecurityContext(learner);

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": 0,
                                      "description": "Zero test",
                                      "paymentMethod": "UPI"
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void withdrawRejectsNegativeAmount() throws Exception {
        User learner = createUser(22L, UserRole.LEARNER);
        setSecurityContext(learner);

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": -50.00,
                                      "description": "Negative test",
                                      "paymentMethod": "PayPal"
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void withdrawRejectsMissingAmount() throws Exception {
        User learner = createUser(23L, UserRole.LEARNER);
        setSecurityContext(learner);

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "description": "No amount",
                                      "paymentMethod": "Bank Transfer"
                                    }
                                    """))
                    .andExpect(status().isBadRequest());
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ── POST /withdraw — service-layer failures ──────────

    @Test
    void withdrawRejectsInsufficientBalance() throws Exception {
        User learner = createUser(30L, UserRole.LEARNER);
        setSecurityContext(learner);

        when(walletService.withdraw(any(User.class), any()))
                .thenThrow(new IllegalArgumentException("Insufficient wallet balance for withdrawal"));

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": 200.00,
                                      "description": "Overdraft attempt",
                                      "paymentMethod": "Bank Transfer"
                                    }
                                    """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Insufficient wallet balance for withdrawal"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ── POST /withdraw — success ─────────────────────────

    @Test
    void withdrawReturnsSuccess() throws Exception {
        User learner = createUser(40L, UserRole.LEARNER);
        setSecurityContext(learner);

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(100L);
        entry.setUser(learner);
        entry.setType(WalletTransactionType.WITHDRAWAL);
        entry.setAmount(new BigDecimal("-50.00"));
        entry.setBalanceAfter(new BigDecimal("50.00"));
        entry.setCurrency("CREDITS");
        entry.setDescription("Withdrawal via Bank Transfer");

        when(walletService.withdraw(any(User.class), any()))
                .thenReturn(entry);

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": 50.00,
                                      "description": "Withdrawal via Bank Transfer",
                                      "paymentMethod": "Bank Transfer"
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Withdrawal processed"))
                    .andExpect(jsonPath("$.data.id").value(100))
                    .andExpect(jsonPath("$.data.type").value("WITHDRAWAL"))
                    .andExpect(jsonPath("$.data.amount").value(-50.00))
                    .andExpect(jsonPath("$.data.balanceAfter").value(50.00))
                    .andExpect(jsonPath("$.data.description").value("Withdrawal via Bank Transfer"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void withdrawWithExactMinAmountReturnsSuccess() throws Exception {
        User learner = createUser(41L, UserRole.LEARNER);
        setSecurityContext(learner);

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(101L);
        entry.setUser(learner);
        entry.setType(WalletTransactionType.WITHDRAWAL);
        entry.setAmount(new BigDecimal("-10.00"));
        entry.setBalanceAfter(new BigDecimal("90.00"));
        entry.setCurrency("CREDITS");
        entry.setDescription("Minimum withdrawal");

        when(walletService.withdraw(any(User.class), any()))
                .thenReturn(entry);

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": 10.00,
                                      "description": "Minimum withdrawal",
                                      "paymentMethod": "UPI"
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Withdrawal processed"))
                    .andExpect(jsonPath("$.data.amount").value(-10.00))
                    .andExpect(jsonPath("$.data.balanceAfter").value(90.00));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ── POST /withdraw — optional fields ─────────────────

    @Test
    void withdrawWithoutDescriptionAndMethodReturnsSuccess() throws Exception {
        User learner = createUser(50L, UserRole.LEARNER);
        setSecurityContext(learner);

        WalletLedgerEntry entry = new WalletLedgerEntry();
        entry.setId(102L);
        entry.setUser(learner);
        entry.setType(WalletTransactionType.WITHDRAWAL);
        entry.setAmount(new BigDecimal("-25.00"));
        entry.setBalanceAfter(new BigDecimal("75.00"));
        entry.setCurrency("CREDITS");
        entry.setDescription("Wallet withdrawal to bank account");

        when(walletService.withdraw(any(User.class), any()))
                .thenReturn(entry);

        try {
            mockMvc.perform(post("/api/v1/wallet/withdraw")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "amount": 25.00
                                    }
                                    """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Withdrawal processed"))
                    .andExpect(jsonPath("$.data.amount").value(-25.00))
                    .andExpect(jsonPath("$.data.description").value("Wallet withdrawal to bank account"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
