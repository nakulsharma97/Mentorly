package com.skillswap.stats;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public")
@RequiredArgsConstructor
public class TestimonialsController {
    private final TestimonialsService testimonialsService;

    @GetMapping("/testimonials")
    public ResponseEntity<List<ReviewDto>> latestTestimonials() {
        return ResponseEntity.ok(testimonialsService.latestApprovedReviews(6));
    }
}
