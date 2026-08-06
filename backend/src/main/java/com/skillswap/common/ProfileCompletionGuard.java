package com.skillswap.common;

import com.skillswap.common.exception.UnauthorizedException;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;
import org.springframework.stereotype.Component;

/**
 * Backend enforcement of the mandatory profile completion flow.
 *
 * <p>
 * Every protected API (sessions, bookings, messaging, analytics, wallet, ...)
 * must call {@link #requireProfileCompleted(User, String)} before doing work so
 * a user with {@code profileCompleted == false} can never bypass the frontend
 * route guards by calling the API directly. Admins are always exempt.
 */
@Component
public class ProfileCompletionGuard {

    /**
     * Throws an HTTP 403 {@link UnauthorizedException} (mapped by
     * {@code ServiceGlobalExceptionHandler}) when the caller's profile is not
     * completed. Admins and fully-onboarded users pass through untouched.
     *
     * @param user          the authenticated principal
     * @param actionMessage the reason shown to the caller, e.g.
     *                      "Please complete your profile before creating sessions."
     */
    public void requireProfileCompleted(User user, String actionMessage) {
        if (user == null || user.getRole() == UserRole.ADMIN) {
            return;
        }
        if (!user.isProfileCompleted()) {
            String message = (actionMessage == null || actionMessage.isBlank())
                    ? "Please complete your profile before continuing."
                    : actionMessage;
            throw new UnauthorizedException(message);
        }
    }
}
