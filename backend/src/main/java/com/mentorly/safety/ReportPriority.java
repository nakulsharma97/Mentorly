package com.mentorly.safety;

/**
 * Triage priority for a user report. Admins can set or change the priority
 * as the investigation progresses; the queue is sortable/filterable by it.
 */
public enum ReportPriority {
    LOW,
    MEDIUM,
    HIGH,
    CRITICAL
}
