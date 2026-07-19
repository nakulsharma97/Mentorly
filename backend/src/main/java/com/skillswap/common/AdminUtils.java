package com.skillswap.common;

import com.skillswap.user.AdminSubRole;
import com.skillswap.user.User;
import com.skillswap.user.UserRole;

/**
 * Shared utility for admin authorization checks across controllers.
 * Eliminates duplicated {@code ensureAdmin()} methods.
 */
public final class AdminUtils {

    private AdminUtils() {
        // Utility class - no instantiation
    }

    /**
     * Ensures the given user is an admin. Throws IllegalArgumentException otherwise.
     *
     * @param currentUser  the authenticated user
     * @param requiredSubRole optional sub-role requirement (only checked if provided)
     */
    public static void ensureAdmin(User currentUser, AdminSubRole... requiredSubRole) {
        if (currentUser == null || currentUser.getRole() != UserRole.ADMIN) {
            throw new IllegalArgumentException("Only admins can access this area");
        }
        if (requiredSubRole.length > 0 && requiredSubRole[0] != null
                && currentUser.getAdminSubRole() != null
                && currentUser.getAdminSubRole() != requiredSubRole[0]
                && currentUser.getAdminSubRole() != AdminSubRole.SUPER_ADMIN) {
            throw new IllegalArgumentException("Insufficient permissions: " + requiredSubRole[0]
                    + " role required, but user has " + currentUser.getAdminSubRole());
        }
    }
}
