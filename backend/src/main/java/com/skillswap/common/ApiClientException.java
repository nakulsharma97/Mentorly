package com.skillswap.common;

import org.springframework.http.HttpStatus;

/**
 * Encapsulates api client exception.
 */
public class ApiClientException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final boolean retryable;

    public ApiClientException(HttpStatus status, String code, String message, boolean retryable) {
        super(message);
        this.status = status;
        this.code = code;
        this.retryable = retryable;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public boolean isRetryable() {
        return retryable;
    }
}
