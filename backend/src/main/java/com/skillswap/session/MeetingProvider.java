package com.skillswap.session;

/**
 * Enum for meeting provider types.
 * Supports multiple providers for future scalability.
 */
public enum MeetingProvider {
    GOOGLE_CALENDAR("google_calendar"),
    ZOOM("zoom"),
    MICROSOFT_TEAMS("microsoft_teams"),
    DAILY("daily"),
    VIDEOSDK("videosdk"),
    LIVEKIT("livekit");

    private final String code;

    MeetingProvider(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }

    public static MeetingProvider fromCode(String code) {
        for (MeetingProvider provider : values()) {
            if (provider.code.equalsIgnoreCase(code)) {
                return provider;
            }
        }
        return GOOGLE_CALENDAR;
    }
}
