package com.skillswap.booking;

import com.skillswap.booking.dto.BookingResponse;
import com.skillswap.common.ApiResponse;
import com.skillswap.common.ProfileCompletionGuard;
import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * REST controller exposing booking approval endpoints.
 */
@RestController
@RequestMapping("/api/v1/admin/bookings")
@RequiredArgsConstructor
public class BookingApprovalController {

    private final BookingService bookingService;
    private final ProfileCompletionGuard profileCompletionGuard;

    @PostMapping("/{bookingId}/approve")
    public ApiResponse<BookingResponse> approveBooking(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long bookingId) {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() != UserRole.MENTOR && currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only mentors and admins can approve bookings");
        }
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before accepting bookings.");

        return new ApiResponse<>("Booking approved", bookingService.approveLearnerBooking(bookingId, currentUser));
    }

    @PostMapping("/{bookingId}/reject")
    public ApiResponse<BookingResponse> rejectBooking(
            @AuthenticationPrincipal User currentUser,
            @PathVariable Long bookingId,
            @RequestParam(required = false) String reason) {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() != UserRole.MENTOR && currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only mentors and admins can reject bookings");
        }
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before accepting bookings.");

        return new ApiResponse<>("Booking rejected",
                bookingService.rejectLearnerBooking(bookingId, reason, currentUser));
    }

    @PostMapping("/bulk-approve")
    public ApiResponse<List<BookingResponse>> bulkApproveBookings(
            @AuthenticationPrincipal User currentUser,
            @RequestParam Long sessionId,
            @RequestBody List<Long> bookingIds) {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() != UserRole.MENTOR && currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only mentors and admins can approve bookings");
        }
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before accepting bookings.");

        return new ApiResponse<>("Bookings approved",
                bookingService.bulkApproveBookings(sessionId, bookingIds, currentUser));
    }

    @PostMapping("/bulk-reject")
    public ApiResponse<List<BookingResponse>> bulkRejectBookings(
            @AuthenticationPrincipal User currentUser,
            @RequestParam Long sessionId,
            @RequestBody List<Long> bookingIds,
            @RequestParam(required = false) String reason) {

        if (currentUser == null) {
            throw new UnauthorizedException("Authentication required");
        }
        if (currentUser.getRole() != UserRole.MENTOR && currentUser.getRole() != UserRole.ADMIN) {
            throw new UnauthorizedException("Only mentors and admins can reject bookings");
        }
        profileCompletionGuard.requireProfileCompleted(currentUser,
                "Please complete your profile before accepting bookings.");

        return new ApiResponse<>("Bookings rejected",
                bookingService.bulkRejectBookings(sessionId, bookingIds, reason, currentUser));
    }
}
