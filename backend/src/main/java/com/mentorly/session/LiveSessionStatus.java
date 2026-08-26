package com.mentorly.session;

/**
 * Enum for live session status throughout its lifecycle.
 */
public enum LiveSessionStatus {
    SCHEDULED("scheduled"),
    LIVE("live"),
    ENDED("ended"),
    CANCELLED("cancelled"),
    RESCHEDULED("rescheduled");

    private final String code;

    LiveSessionStatus(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public boolean isActive() {
        return this == SCHEDULED || this == LIVE;
    }

    public boolean isCompleted() {
        return this == ENDED || this == CANCELLED;
    }
}
