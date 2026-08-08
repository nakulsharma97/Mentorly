package com.skillswap.learning;

/**
 * Lifecycle status of a learner's roadmap. A learner may own many roadmaps but
 * only one is ever {@code ACTIVE} at a time.
 */
public enum RoadmapStatus {
    /** Created but never started. */
    NOT_STARTED,
    /** The currently followed roadmap. */
    ACTIVE,
    /** Previously followed; progress is preserved but the path is on hold. */
    ARCHIVED
}
