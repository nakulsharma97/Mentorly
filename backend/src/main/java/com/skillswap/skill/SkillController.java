package com.skillswap.skill;

import com.skillswap.common.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/skills")
@RequiredArgsConstructor
public class SkillController {

    private final SkillRepository skillRepository;

    @GetMapping
    public ApiResponse<List<Skill>> getAll() {
        return new ApiResponse<>("Skills fetched", skillRepository.findAll());
    }

    @PostMapping
    public ApiResponse<Skill> create(@RequestBody Skill skill) {
        return new ApiResponse<>("Skill created", skillRepository.save(skill));
    }
}
