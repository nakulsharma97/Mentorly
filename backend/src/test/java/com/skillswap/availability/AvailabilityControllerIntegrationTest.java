package com.skillswap.availability;

import com.skillswap.config.EndpointRateLimitFilter;
import com.skillswap.config.JwtAuthenticationFilter;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
    private UserDetailsService userDetailsService;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginSuccessHandler oAuth2LoginSuccessHandler;

    @MockitoBean
    private com.skillswap.auth.OAuth2LoginFailureHandler oAuth2LoginFailureHandler;

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
}
