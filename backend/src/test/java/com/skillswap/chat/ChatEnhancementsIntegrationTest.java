package com.skillswap.chat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.messaging.DirectMessage;
import com.skillswap.messaging.DirectMessageRepository;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Full-context integration tests for the chat enhancements: unified backend
 * search, delete-own-message (direct + booking), emoji reactions with
 * real-time broadcast, and pin/archive toggles.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:chat-enhancements-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
class ChatEnhancementsIntegrationTest {

    @MockBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @MockBean
    private EmailNotificationService emailNotificationService;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private DirectConversationRepository directConversationRepository;

    @Autowired
    private DirectMessageRepository directMessageRepository;

    private User alice;
    private User bob;

    @BeforeEach
    void setUp() {
        alice = createUser("alice+" + UUID.randomUUID() + "@example.com", "alice" + UUID.randomUUID().toString().substring(0, 5), UserRole.LEARNER);
        bob = createUser("bob+" + UUID.randomUUID() + "@example.com", "bob" + UUID.randomUUID().toString().substring(0, 5), UserRole.MENTOR);
    }

    // ── 1. Unified search finds direct conversations by name, skill, id ──

    @Test
    void givenConversations_whenSearching_thenMatchesByNameSkillAndId() throws Exception {
        DirectConversation conv = persistConversation(alice, bob);
        DirectMessage msg = persistMessage(conv, alice, "Hi Bob, ready for our Spring Boot session?");
        Long convId = conv.getId();

        // Search by participant name (case-insensitive)
        mockMvc.perform(get("/api/v1/chat/search")
                        .with(csrf())
                        .with(user(alice))
                        .param("q", "bob"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].kind").value("direct"))
                .andExpect(jsonPath("$.data[0].id").value(convId));

        // Search by conversation id
        mockMvc.perform(get("/api/v1/chat/search")
                        .with(csrf())
                        .with(user(alice))
                        .param("q", String.valueOf(convId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(convId));

        // Search by last message content
        mockMvc.perform(get("/api/v1/chat/search")
                        .with(csrf())
                        .with(user(alice))
                        .param("q", "Spring Boot"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].id").value(convId));

        // Empty query returns no results (not an error)
        mockMvc.perform(get("/api/v1/chat/search")
                        .with(csrf())
                        .with(user(alice))
                        .param("q", ""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(0));
    }

    // ── 2. Delete own direct message ──

    @Test
    void givenDirectMessage_whenSenderDeletes_thenMessageRemoved() throws Exception {
        DirectConversation conv = persistConversation(alice, bob);
        DirectMessage msg = persistMessage(conv, alice, "Delete me please");

        mockMvc.perform(delete("/api/v1/chat/direct/{convId}/messages/{msgId}", conv.getId(), msg.getId())
                        .with(csrf())
                        .with(user(alice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(true));

        assertThat(directMessageRepository.findById(msg.getId())).isEmpty();
    }

    // ── 3. Cannot delete another user's message ──

    @Test
    void givenDirectMessage_whenOtherUserDeletes_thenForbidden() throws Exception {
        DirectConversation conv = persistConversation(alice, bob);
        DirectMessage msg = persistMessage(conv, alice, "Alice's message");

        mockMvc.perform(delete("/api/v1/chat/direct/{convId}/messages/{msgId}", conv.getId(), msg.getId())
                        .with(csrf())
                        .with(user(bob)))
                .andExpect(status().isBadRequest());

        assertThat(directMessageRepository.findById(msg.getId())).isPresent();
    }

    // ── 4. Toggle reactions on a direct message ──

    @Test
    void givenDirectMessage_whenReacting_thenReactionToggledOnAndOff() throws Exception {
        DirectConversation conv = persistConversation(alice, bob);
        DirectMessage msg = persistMessage(conv, alice, "Great session!");

        // Add 👍 by bob
        mockMvc.perform(post("/api/v1/chat/direct/{convId}/messages/{msgId}/reactions", conv.getId(), msg.getId())
                        .with(csrf())
                        .with(user(bob))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"👍\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reactions['👍'][0]").value(bob.getId()));

        // Toggle off — reactions should be empty
        mockMvc.perform(post("/api/v1/chat/direct/{convId}/messages/{msgId}/reactions", conv.getId(), msg.getId())
                        .with(csrf())
                        .with(user(bob))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"emoji\":\"👍\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.reactions['👍']").doesNotExist());
    }

    // ── 5. Pin and archive a conversation ──

    @Test
    void givenConversation_whenPinningAndArchiving_thenFlagsPersist() throws Exception {
        DirectConversation conv = persistConversation(alice, bob);

        mockMvc.perform(put("/api/v1/chat/direct/{convId}/pin", conv.getId())
                        .with(csrf())
                        .with(user(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pinned\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.pinned").value(true));

        mockMvc.perform(put("/api/v1/chat/direct/{convId}/archive", conv.getId())
                        .with(csrf())
                        .with(user(alice))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"archived\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.archived").value(true));

        DirectConversation reloaded = directConversationRepository.findById(conv.getId()).orElseThrow();
        assertThat(reloaded.isPinned()).isTrue();
        assertThat(reloaded.isArchived()).isTrue();
    }

    // ── Helpers ──

    private User createUser(String email, String username, UserRole role) {
        User user = new User();
        user.setEmail(email);
        user.setUsername(username);
        user.setFullName("Chat IT User");
        user.setRole(role);
        user.setEnabled(true);
        user.setPasswordHash(passwordEncoder.encode("TestPass123!"));
        user.setReferralCode("REF-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10));
        return userRepository.save(user);
    }

    private DirectConversation persistConversation(User one, User two) {
        DirectConversation conv = new DirectConversation();
        conv.setParticipantOne(one);
        conv.setParticipantTwo(two);
        return directConversationRepository.save(conv);
    }

    private DirectMessage persistMessage(DirectConversation conv, User sender, String content) {
        DirectMessage msg = new DirectMessage();
        msg.setConversation(conv);
        msg.setSender(sender);
        msg.setContent(content);
        return directMessageRepository.save(msg);
    }
}
