package com.skillswap.common;

import io.sentry.Sentry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.ConstraintViolationException;

import org.slf4j.MDC;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiClientException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleApiClientException(ApiClientException ex) {
        log.warn("API client exception: {}", ex.getMessage(), ex);
        return ResponseEntity.status(ex.getStatus())
                .body(new ApiResponse<>("Request failed", baseError(ex.getCode(), ex.getMessage(), ex.isRetryable())));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        log.warn("Invalid request: {}", ex.getMessage(), ex);
        return new ApiResponse<>("Request failed", baseError("BAD_REQUEST", ex.getMessage(), false));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        err -> err.getField(),
                        err -> err.getDefaultMessage() == null ? "Invalid value" : err.getDefaultMessage(),
                        (first, second) -> first,
                        LinkedHashMap::new));
        log.warn("Validation failed: {}", errors, ex);
        return ResponseEntity.badRequest().body(new ApiResponse<>("Request failed", validationBody(errors)));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleConstraintViolation(ConstraintViolationException ex) {
        Map<String, String> errors = ex.getConstraintViolations().stream()
                .collect(Collectors.toMap(
                        violation -> {
                            String path = violation.getPropertyPath() == null ? "request"
                                    : violation.getPropertyPath().toString();
                            int lastDot = path.lastIndexOf('.');
                            return lastDot >= 0 ? path.substring(lastDot + 1) : path;
                        },
                        violation -> violation.getMessage() == null ? "Invalid value" : violation.getMessage(),
                        (first, second) -> first,
                        LinkedHashMap::new));
        log.warn("Constraint violation: {}", errors, ex);
        return ResponseEntity.badRequest().body(new ApiResponse<>("Request failed", validationBody(errors)));
    }

    @ExceptionHandler({ MethodArgumentTypeMismatchException.class, ResponseStatusException.class })
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, Object>> handleRequestFormat(Exception ex) {
        log.warn("Request format error", ex);
        return new ApiResponse<>("Request failed", baseError("REQUEST_FORMAT_ERROR", "Invalid request format", false));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Map<String, Object>> handleUnhandled(Exception ex) {
        log.error("Unhandled exception processing request", ex);
        Sentry.captureException(ex);
        String message = ex.getMessage() == null ? "Unexpected server error" : ex.getMessage();
        return new ApiResponse<>("Request failed", baseError("INTERNAL_ERROR", message, true));
    }

    private Map<String, Object> baseError(String code, String errorMessage, boolean retryable) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", code);
        error.put("error", errorMessage);
        error.put("message", errorMessage);
        error.put("retryable", retryable);
        error.put("traceId", MDC.get("traceId") == null ? "na" : MDC.get("traceId"));
        return error;
    }

    private Map<String, Object> validationBody(Map<String, String> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", 400);
        body.put("errors", errors);
        return body;
    }
}
