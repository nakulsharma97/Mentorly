package com.skillswap.stats;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CommunityStatsDto {
    private long totalUsers;
    private long activeUsers;
    private long skillsOffered;
    private long completedSwaps;
    private double averageRating;
    /** Percentage (0-100) of all bookings that reached COMPLETED status. */
    private double completionRate;
}
