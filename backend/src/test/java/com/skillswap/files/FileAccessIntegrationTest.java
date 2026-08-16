package com.skillswap.files;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.skillswap.booking.Booking;
import com.skillswap.booking.BookingRepository;
import com.skillswap.messaging.DirectConversation;
import com.skillswap.messaging.DirectConversationRepository;
import com.skillswap.notification.EmailNotificationService;
import com.skillswap.session.SessionRepository;
import com.skillswap.session.SessionType;
import com.skillswap.session.SkillSession;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import com.skillswap.user.UserRole;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.annotation.Rollback;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Security integration tests for uploaded files:
 *
 * <ul>
 *   <li>Uploads return a protected {@code /api/v1/files/{id}/content} URL —
 *       not a public {@code /uploads/**} path.</li>
 *   <li>Only the owner, chat participants, or admins may download a file;
 *       unrelated authenticated users and anonymous callers are rejected.</li>
 *   <li>Files expire and become inaccessible after their retention window.</li>
 * </ul>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "spring.datasource.url=jdbc:h2:mem:file-access-it;MODE=MySQL;DB_CLOSE_DELAY=-1",
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
        "app.polygon.rpc-url=http://localhost:8545",
        "app.files.expiration-days=30"
})
@Transactional
@Rollback
class FileAccessIntegrationTest {

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
    private SessionRepository sessionRepository;

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private DirectConversationRepository directConversationRepository;

    @Autowired
    private StoredFileRepository storedFileRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    private User owner;
    private User stranger;
    private User admin;
    private User mentor;
    private User learner;
    private SkillSession session;

    /** UUID filenames present in uploads/chat before the test started. */
    private List<String> filesBeforeTest = new ArrayList<>();

    @BeforeEach
    void setUp() throws IOException {
        owner = createUser(uniqueEmail("owner"), UserRole.LEARNER, true);
        stranger = createUser(uniqueEmail("stranger"), UserRole.LEARNER, true);
        admin = createUser(uniqueEmail("admin"), UserRole.ADMIN, true);
        mentor = createUser(uniqueEmail("mentor"), UserRole.MENTOR, true);
        learner = createUser(uniqueEmail("learner"), UserRole.LEARNER, true);
        session = createSession(mentor);
        filesBeforeTest = snapshotUploadDir();
    }

    /**
     * The uploads are written to real disk (uploads/chat/) and @Rollback only
     * rolls back the DB rows, so delete any files the test just created to
     * avoid leaking orphaned bytes on every run.
     */
    @AfterEach
    void cleanupUploadedFiles() throws IOException {
        Path dir = Paths.get("uploads", "chat");
        if (!Files.isDirectory(dir)) {
            return;
        }
        try (var stream = Files.list(dir)) {
            stream
                    .filter(p -> !filesBeforeTest.contains(p.getFileName().toString()))
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                            // best-effort cleanup — never fail a test over leftover bytes
                        }
                    });
        }
    }

    private List<String> snapshotUploadDir() throws IOException {
        Path dir = Paths.get("uploads", "chat");
        if (!Files.isDirectory(dir)) {
            return List.of();
        }
        try (var stream = Files.list(dir)) {
            return stream.map(p -> p.getFileName().toString()).toList();
        }
    }

    // ── 1. Upload returns a protected content URL (not /uploads/...) ──

    @Test
    void upload_returnsProtectedContentUrl() throws Exception {
        MvcResult result = upload(owner, "image.png", "image/png", new byte[]{1, 2, 3, 4}, null, null);
        String url = readUrl(result);

        assertThat(url).startsWith("/api/v1/files/");
        assertThat(url).endsWith("/content");
        assertThat(url).doesNotContain("/uploads/");
    }

    // ── 2. Owner can download their own file ──

    @Test
    void download_ownerCanFetchFile() throws Exception {
        MvcResult uploadResult = upload(owner, "hello.txt", "text/plain", "hello world".getBytes(), null, null);
        String url = readUrl(uploadResult);

        mockMvc.perform(get(url).with(user(owner)))
                .andExpect(status().isOk())
                .andExpect(content().bytes("hello world".getBytes()));
    }

    // ── 3. Stranger (authenticated, unrelated) cannot download ──

    @Test
    void download_unrelatedAuthenticatedUserIsRejected() throws Exception {
        MvcResult uploadResult = upload(owner, "secret.png", "image/png", new byte[]{9, 9}, null, null);
        String url = readUrl(uploadResult);

        mockMvc.perform(get(url).with(user(stranger)))
                .andExpect(status().isForbidden());
    }

    // ── 4. Anonymous caller cannot download ──

    @Test
    void download_anonymousCallerIsRejected() throws Exception {
        MvcResult uploadResult = upload(owner, "secret.png", "image/png", new byte[]{9, 9}, null, null);
        String url = readUrl(uploadResult);

        mockMvc.perform(get(url))
                .andExpect(status().isUnauthorized());
    }

    // ── 5. Admin can download any file ──

    @Test
    void download_adminCanFetchAnyFile() throws Exception {
        MvcResult uploadResult = upload(owner, "doc.pdf", "application/pdf", new byte[]{1, 2, 3}, null, null);
        String url = readUrl(uploadResult);

        mockMvc.perform(get(url).with(user(admin)))
                .andExpect(status().isOk());
    }

    // ── 6. Booking chat participants (learner + mentor) can download ──

    @Test
    void download_bookingLearnerAndMentorCanFetchAttachment() throws Exception {
        Booking booking = createBooking(session, learner);

        MvcResult uploadResult = upload(mentor, "handout.pdf", "application/pdf", new byte[]{5, 5, 5},
                StoredFileService.CONTEXT_BOOKING_CHAT, booking.getId());
        String url = readUrl(uploadResult);

        // Both participants of the booking chat are authorized.
        mockMvc.perform(get(url).with(user(learner))).andExpect(status().isOk());
        mockMvc.perform(get(url).with(user(mentor))).andExpect(status().isOk());

        // A learner on a DIFFERENT booking is not.
        mockMvc.perform(get(url).with(user(stranger))).andExpect(status().isForbidden());
    }

    // ── 6b. Upload validates the claimed chat context (ownership at upload time) ──

    @Test
    void upload_bookingContextByNonParticipantIsRejected() throws Exception {
        Booking booking = createBooking(session, learner);

        // `owner` is not a participant of this booking (mentor <-> learner).
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(new MockMultipartFile("file", "planted.pdf",
                                "application/pdf", new byte[]{1, 2, 3}))
                        .param("contextType", StoredFileService.CONTEXT_BOOKING_CHAT)
                        .param("contextId", String.valueOf(booking.getId()))
                        .with(csrf())
                        .with(user(owner)))
                .andExpect(status().isForbidden());
    }

    @Test
    void upload_directContextByNonParticipantIsRejected() throws Exception {
        DirectConversation conversation = createConversation(owner, stranger);

        // `learner` is not a participant of this direct conversation.
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(new MockMultipartFile("file", "planted.png",
                                "image/png", new byte[]{1, 2, 3}))
                        .param("contextType", StoredFileService.CONTEXT_DIRECT_CHAT)
                        .param("contextId", String.valueOf(conversation.getId()))
                        .with(csrf())
                        .with(user(learner)))
                .andExpect(status().isForbidden());
    }

    @Test
    void upload_unknownContextTypeIsRejected() throws Exception {
        // Allowed file type (text/plain) so the 400 comes from the context
        // validation, not the file-type whitelist.
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(new MockMultipartFile("file", "note.txt",
                                "text/plain", "hi".getBytes()))
                        .param("contextType", "UNKNOWN_CHAT")
                        .param("contextId", "1")
                        .with(csrf())
                        .with(user(owner)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upload_adminMayAttachToAnyContext() throws Exception {
        Booking booking = createBooking(session, learner);

        // Admins can download any file, so they may also attach into any context.
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(new MockMultipartFile("file", "admin-note.txt",
                                "text/plain", "admin".getBytes()))
                        .param("contextType", StoredFileService.CONTEXT_BOOKING_CHAT)
                        .param("contextId", String.valueOf(booking.getId()))
                        .with(csrf())
                        .with(user(admin)))
                .andExpect(status().isOk());
    }

    @Test
    void upload_bookingParticipantCanAttach() throws Exception {
        Booking booking = createBooking(session, learner);

        // The learner (a participant) may attach to the booking chat.
        mockMvc.perform(multipart("/api/v1/files/upload")
                        .file(new MockMultipartFile("file", "note.txt",
                                "text/plain", "hi".getBytes()))
                        .param("contextType", StoredFileService.CONTEXT_BOOKING_CHAT)
                        .param("contextId", String.valueOf(booking.getId()))
                        .with(csrf())
                        .with(user(learner)))
                .andExpect(status().isOk());
    }

    // ── 7. Direct chat participants can download ──

    @Test
    void download_directConversationParticipantsCanFetchAttachment() throws Exception {
        DirectConversation conversation = createConversation(owner, stranger);

        MvcResult uploadResult = upload(owner, "photo.png", "image/png", new byte[]{7, 7},
                StoredFileService.CONTEXT_DIRECT_CHAT, conversation.getId());
        String url = readUrl(uploadResult);

        mockMvc.perform(get(url).with(user(stranger))).andExpect(status().isOk());
        mockMvc.perform(get(url).with(user(admin))).andExpect(status().isOk());

        // Unrelated user is still blocked.
        mockMvc.perform(get(url).with(user(learner))).andExpect(status().isForbidden());
    }

    // ── 8. Expired files are inaccessible ──

    @Test
    void download_expiredFileIsRejected() throws Exception {
        MvcResult uploadResult = upload(owner, "old.png", "image/png", new byte[]{1}, null, null);
        String url = readUrl(uploadResult);
        long fileId = extractId(url);

        // Expire it directly in the DB.
        StoredFile file = storedFileRepository.findById(fileId).orElseThrow();
        file.setExpiresAt(OffsetDateTime.now().minusDays(1));
        storedFileRepository.save(file);

        mockMvc.perform(get(url).with(user(owner)))
                .andExpect(status().isNotFound());
    }

    // ── 9. Direct static /uploads/** access is not served ──

    @Test
    void uploadsStaticPath_isNotPubliclyAccessible() throws Exception {
        mockMvc.perform(get("/uploads/chat/anything.png"))
                .andExpect(status().isUnauthorized());
    }

    // ── Helpers ──

    private MvcResult upload(User uploader, String filename, String contentType, byte[] bytes,
            String contextType, Long contextId) throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", filename, contentType, bytes);
        var request = multipart("/api/v1/files/upload")
                .file(file)
                .with(csrf())
                .with(user(uploader));
        if (contextType != null) {
            request.param("contextType", contextType);
        }
        if (contextId != null) {
            request.param("contextId", String.valueOf(contextId));
        }
        return mockMvc.perform(request)
                .andExpect(status().isOk())
                .andReturn();
    }

    private String readUrl(MvcResult result) throws Exception {
        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        return root.path("data").path("url").asText();
    }

    private long extractId(String url) {
        return Long.parseLong(url.replace("/api/v1/files/", "").replace("/content", ""));
    }

    private User createUser(String email, UserRole role, boolean enabled) {
        User user = new User();
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode("Password123!"));
        user.setRole(role);
        user.setUsername(email.substring(0, email.indexOf('@')).replaceAll("[^a-zA-Z0-9_]", "")
                + UUID.randomUUID().toString().substring(0, 4));
        user.setFullName(role.name() + " " + UUID.randomUUID().toString().substring(0, 6));
        user.setEnabled(enabled);
        return userRepository.save(user);
    }

    private SkillSession createSession(User sessionMentor) {
        SkillSession s = new SkillSession();
        s.setMentor(sessionMentor);
        s.setTitle("File IT Session " + UUID.randomUUID().toString().substring(0, 8));
        s.setSessionType(SessionType.PUBLIC);
        s.setStartTime(OffsetDateTime.now().plusDays(1));
        s.setEndTime(OffsetDateTime.now().plusDays(1).plusHours(1));
        s.setPriceAmount(new BigDecimal("50.00"));
        s.setMaxParticipants(1);
        return sessionRepository.save(s);
    }

    private Booking createBooking(SkillSession session, User bookingLearner) {
        Booking booking = new Booking();
        booking.setSession(session);
        booking.setLearner(bookingLearner);
        return bookingRepository.save(booking);
    }

    private DirectConversation createConversation(User p1, User p2) {
        DirectConversation conversation = new DirectConversation();
        conversation.setParticipantOne(p1);
        conversation.setParticipantTwo(p2);
        return directConversationRepository.save(conversation);
    }

    private String uniqueEmail(String prefix) {
        return prefix + "+" + UUID.randomUUID() + "@example.com";
    }
}
