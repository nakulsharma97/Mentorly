package com.skillswap.availability;

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

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AvailabilityController.class)
@AutoConfigureMockMvc(addFilters = false)
class AvailabilityControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private UserAvailabilitySlotRepository slotRepository;

    @MockitoBean
    private com.skillswap.booking.BookingRepository bookingRepository;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @MockitoBean
    private EndpointRateLimitFilter endpointRateLimitFilter;

    @MockitoBean
    private RequestTraceFilter requestTraceFilter;

    @MockitoBean
    private MaintenanceModeFilter maintenanceModeFilter;


    @MockitoBean
    private UserDetailsService userDetailsService;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

    @MockitoBean
    private com.skillswap.session.SessionAutoCreationService sessionAutoCreationService;

    @MockitoBean
    private ClientRegistrationRepository clientRegistrationRepository;

    @Test
    void createSlotReturnsCreatedSlotWhenRequestIsValid() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            UserAvailabilitySlot saved = new UserAvailabilitySlot();
            saved.setId(101L);
            saved.setUser(mentor);
            saved.setDayOfWeek(2);
            saved.setStartTime("09:00");
            saved.setEndTime("11:00");
            saved.setTimezone("UTC");
            saved.setActive(true);

            when(slotRepository.save(any(UserAvailabilitySlot.class))).thenReturn(saved);

            mockMvc.perform(post("/api/v1/availability/my-slots")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "dayOfWeek": 2,
                              "startTime": "09:00",
                              "endTime": "11:00",
                              "timezone": "UTC",
                              "active": true
                            }
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Availability slot created"))
                    .andExpect(jsonPath("$.data.id").value(101))
                    .andExpect(jsonPath("$.data.dayOfWeek").value(2))
                    .andExpect(jsonPath("$.data.startTime").value("09:00"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void createSlotReturnsBadRequestWhenTimezoneIsInvalid() throws Exception {
        User mentor = new User();
        mentor.setId(22L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(post("/api/v1/availability/my-slots")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "dayOfWeek": 1,
                              "startTime": "09:00",
                              "endTime": "11:00",
                              "timezone": "Invalid/Zone"
                            }
                            """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value(
                            "Invalid availability slot time or timezone. Use HH:mm times and a valid timezone identifier."));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ═══════════════════════════════════════════════════════
    //  PATCH /api/v1/availability/my-slots/{id} — updateSlot
    // ═══════════════════════════════════════════════════════

    @Test
    void updateSlotReturnsUpdatedSlotWhenRequestIsValid() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            UserAvailabilitySlot existing = new UserAvailabilitySlot();
            existing.setId(101L);
            existing.setUser(mentor);
            existing.setDayOfWeek(1);
            existing.setStartTime("09:00");
            existing.setEndTime("17:00");
            existing.setTimezone("UTC");
            existing.setActive(true);

            UserAvailabilitySlot updated = new UserAvailabilitySlot();
            updated.setId(101L);
            updated.setUser(mentor);
            updated.setDayOfWeek(3);
            updated.setStartTime("14:00");
            updated.setEndTime("18:00");
            updated.setTimezone("America/New_York");
            updated.setActive(true);

            when(slotRepository.findById(101L)).thenReturn(Optional.of(existing));
            when(slotRepository.save(any(UserAvailabilitySlot.class))).thenReturn(updated);

            mockMvc.perform(patch("/api/v1/availability/my-slots/101")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "dayOfWeek": 3,
                              "startTime": "14:00",
                              "endTime": "18:00",
                              "timezone": "America/New_York",
                              "active": true
                            }
                            """))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Availability slot updated"))
                    .andExpect(jsonPath("$.data.id").value(101))
                    .andExpect(jsonPath("$.data.dayOfWeek").value(3))
                    .andExpect(jsonPath("$.data.startTime").value("14:00"))
                    .andExpect(jsonPath("$.data.endTime").value("18:00"))
                    .andExpect(jsonPath("$.data.timezone").value("America/New_York"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void updateSlotReturnsBadRequestWhenSlotNotFound() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            when(slotRepository.findById(999L)).thenReturn(Optional.empty());

            mockMvc.perform(patch("/api/v1/availability/my-slots/999")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "dayOfWeek": 1,
                              "startTime": "09:00",
                              "endTime": "17:00",
                              "timezone": "UTC",
                              "active": true
                            }
                            """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Availability slot not found"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void updateSlotReturnsBadRequestWhenUserNotOwner() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        User otherMentor = new User();
        otherMentor.setId(99L);
        otherMentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            UserAvailabilitySlot existing = new UserAvailabilitySlot();
            existing.setId(101L);
            existing.setUser(otherMentor);
            existing.setDayOfWeek(1);
            existing.setStartTime("09:00");
            existing.setEndTime("17:00");
            existing.setTimezone("UTC");
            existing.setActive(true);

            when(slotRepository.findById(101L)).thenReturn(Optional.of(existing));

            mockMvc.perform(patch("/api/v1/availability/my-slots/101")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "dayOfWeek": 2,
                              "startTime": "10:00",
                              "endTime": "14:00",
                              "timezone": "UTC",
                              "active": true
                            }
                            """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Cannot update another user's slot"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void updateSlotReturnsBadRequestWhenTimezoneIsInvalid() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            mockMvc.perform(patch("/api/v1/availability/my-slots/101")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {
                              "dayOfWeek": 1,
                              "startTime": "09:00",
                              "endTime": "17:00",
                              "timezone": "NotARealTimezone"
                            }
                            """))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value(
                            "Invalid availability slot time or timezone. Use HH:mm times and a valid timezone identifier."));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    // ═══════════════════════════════════════════════════════
    //  DELETE /api/v1/availability/my-slots/{id} — deleteSlot
    // ═══════════════════════════════════════════════════════

    @Test
    void deleteSlotReturnsSuccessWhenSlotExists() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            UserAvailabilitySlot slot = new UserAvailabilitySlot();
            slot.setId(101L);
            slot.setUser(mentor);
            slot.setDayOfWeek(1);
            slot.setStartTime("09:00");
            slot.setEndTime("17:00");
            slot.setTimezone("UTC");
            slot.setActive(true);

            when(slotRepository.findById(101L)).thenReturn(Optional.of(slot));

            mockMvc.perform(delete("/api/v1/availability/my-slots/101"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.message").value("Availability slot deleted"))
                    .andExpect(jsonPath("$.data").value(true));

            verify(slotRepository).delete(slot);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void deleteSlotReturnsBadRequestWhenSlotNotFound() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            when(slotRepository.findById(999L)).thenReturn(Optional.empty());

            mockMvc.perform(delete("/api/v1/availability/my-slots/999"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Availability slot not found"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    @Test
    void deleteSlotReturnsBadRequestWhenUserNotOwner() throws Exception {
        User mentor = new User();
        mentor.setId(21L);
        mentor.setRole(UserRole.MENTOR);

        User otherMentor = new User();
        otherMentor.setId(99L);
        otherMentor.setRole(UserRole.MENTOR);

        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(new UsernamePasswordAuthenticationToken(mentor, null,
                mentor.getAuthorities()));
        SecurityContextHolder.setContext(context);

        try {
            UserAvailabilitySlot slot = new UserAvailabilitySlot();
            slot.setId(101L);
            slot.setUser(otherMentor);
            slot.setDayOfWeek(1);
            slot.setStartTime("09:00");
            slot.setEndTime("17:00");
            slot.setTimezone("UTC");
            slot.setActive(true);

            when(slotRepository.findById(101L)).thenReturn(Optional.of(slot));

            mockMvc.perform(delete("/api/v1/availability/my-slots/101"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.data.error").value("Cannot delete another user's slot"));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }
}
