package com.skillswap.common.exception;

import com.skillswap.common.ApiResponse;
import com.skillswap.meeting.provider.MeetingProviderException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Secondary exception handler for service-layer exceptions.
 * Uses the same {@code ApiResponse} error format as {@code GlobalExceptionHandler}
 * so all error responses are structurally consistent across the entire API.
 */
/**
 * Encapsulates service global exception.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ServiceGlobalExceptionHandler {

    private static final Logger LOG = LoggerFactory.getLogger(ServiceGlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleResourceNotFound(ResourceNotFoundException ex) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage());
    }

    @ExceptionHandler(UnauthorizedException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleUnauthorized(UnauthorizedException ex) {
        return build(HttpStatus.FORBIDDEN, "FORBIDDEN", ex.getMessage());
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleBadRequest(BadRequestException ex) {
        return build(HttpStatus.BAD_REQUEST, "BAD_REQUEST", ex.getMessage());
    }

    @ExceptionHandler(MeetingProviderException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleMeetingProviderException(
            MeetingProviderException ex) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "MEETING_PROVIDER_ERROR", ex.getMessage());
    }

    // Note: @ExceptionHandler(Exception.class) is intentionally omitted here.
    // GlobalExceptionHandler (LOWEST_PRECEDENCE) already handles generic
    // exceptions, so adding it here would be dead code — this advice wins for
    // the specific service exceptions it declares because it runs first.
    // All specific exceptions (ResourceNotFoundException, etc.) are handled above.

    private ResponseEntity<ApiResponse<Map<String, Object>>> build(HttpStatus status, String code, String message) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("error", message);
        error.put("message", message);
        error.put("retryable", false);
        error.put("traceId", MDC.get("traceId") == null ? "na" : MDC.get("traceId"));
        return ResponseEntity.status(status).body(new ApiResponse<>("Request failed", error));
    }
}
