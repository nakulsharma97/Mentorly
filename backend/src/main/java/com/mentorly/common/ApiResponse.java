package com.mentorly.common;

/**
 * Immutable data carrier for api response.
 */
public record ApiResponse<T>(String message, T data) {
}
