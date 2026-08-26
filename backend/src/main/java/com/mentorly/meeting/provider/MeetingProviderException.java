package com.mentorly.meeting.provider;

/**
 * Exception thrown when a meeting provider operation fails.
 */
public class MeetingProviderException extends Exception {

    private String providerName;

    private String errorCode;

    public MeetingProviderException(String message) {
        super(message);
    }

    public MeetingProviderException(String message, Throwable cause) {
        super(message, cause);
    }

    public MeetingProviderException(String providerName, String errorCode, String message) {
        super(message);
        this.providerName = providerName;
        this.errorCode = errorCode;
    }

    public MeetingProviderException(String providerName, String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.providerName = providerName;
        this.errorCode = errorCode;
    }

    public String getProviderName() {
        return providerName;
    }

    public String getErrorCode() {
        return errorCode;
    }
}
