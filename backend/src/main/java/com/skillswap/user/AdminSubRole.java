package com.skillswap.user;

/**
 * Sub-roles for admin users to enable granular access control:
 * - SUPER_ADMIN: Full access to all admin features
 * - MODERATOR: Content moderation, reports, flagged content only
 * - FINANCE: Payments, refunds, wallet only
 * - SUPPORT: Users, conversations, sessions only
 */
public enum AdminSubRole {
    SUPER_ADMIN,
    MODERATOR,
    FINANCE,
    SUPPORT
}
