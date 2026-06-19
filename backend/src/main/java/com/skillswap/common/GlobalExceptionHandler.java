package com.skillswap.common;

import io.sentry.Sentry;
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
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiClientException.class)
    public ResponseEntity<ApiResponse<Map<String, Object>>> handleApiClientException(ApiClientException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(new ApiResponse<>("Request failed", baseError(ex.getCode(), ex.getMessage(), ex.isRetryable())));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, Object>> handleIllegalArgument(IllegalArgumentException ex) {
        return new ApiResponse<>("Request failed", baseError("BAD_REQUEST", ex.getMessage(), false));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        err -> err.getField(),
                        err -> err.getDefaultMessage() == null ? "Invalid value" : err.getDefaultMessage(),
                        (first, second) -> first,
                        LinkedHashMap::new));
        return ResponseEntity.badRequest().body(validationBody(errors));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<Map<String, Object>> handleConstraintViolation(ConstraintViolationException ex) {
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
        return ResponseEntity.badRequest().body(validationBody(errors));
    }

    @ExceptionHandler({ MethodArgumentTypeMismatchException.class, ResponseStatusException.class })
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Map<String, Object>> handleRequestFormat(Exception ex) {
        return new ApiResponse<>("Request failed", baseError("REQUEST_FORMAT_ERROR", "Invalid request format", false));
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Map<String, Object>> handleUnhandled(Exception ex) {
        Sentry.captureException(ex);
        return new ApiResponse<>("Request failed", baseError("INTERNAL_ERROR", "Unexpected server error", true));
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
