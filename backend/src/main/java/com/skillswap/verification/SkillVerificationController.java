package com.skillswap.verification;

import com.skillswap.common.ApiResponse;
import com.skillswap.user.User;
import com.skillswap.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

/**
 * REST controller exposing skill verification endpoints.
 */
@RestController
@RequestMapping("/api/v1/verification")
@RequiredArgsConstructor
public class SkillVerificationController {

    private final SkillVerificationTaskRepository taskRepository;
    private final SkillVerificationSubmissionRepository submissionRepository;
    private final UserRepository userRepository;

    @GetMapping("/tasks")
    public ApiResponse<List<SkillVerificationTask>> listTasks(@RequestParam(required = false) Long mentorId) {
        List<SkillVerificationTask> tasks = mentorId == null
                ? taskRepository.findByActiveTrue()
                : taskRepository.findByMentorId(mentorId);
        return new ApiResponse<>("Verification tasks fetched", tasks);
    }

    @PostMapping("/tasks")
    public ApiResponse<SkillVerificationTask> createTask(
            @AuthenticationPrincipal User mentor,
            @RequestBody CreateTaskRequest req) {
        SkillVerificationTask task = new SkillVerificationTask();
        task.setMentor(mentor);
        task.setSkillName(req.skillName());
        task.setTitle(req.title());
        task.setInstructions(req.instructions());
        task.setActive(req.active() == null || req.active());

        return new ApiResponse<>("Verification task created", taskRepository.save(task));
    }

    @GetMapping("/submissions")
    public ApiResponse<List<SkillVerificationSubmission>> listSubmissions(@AuthenticationPrincipal User currentUser) {
        List<SkillVerificationSubmission> submissions = currentUser.getRole().name().equals("MENTOR")
                ? submissionRepository.findByTaskMentorId(currentUser.getId())
                : submissionRepository.findByLearnerId(currentUser.getId());
        return new ApiResponse<>("Verification submissions fetched", submissions);
    }

    @PostMapping("/tasks/{taskId}/submit")
    public ApiResponse<SkillVerificationSubmission> submitTask(
            @AuthenticationPrincipal User learner,
            @PathVariable Long taskId,
            @RequestBody SubmitTaskRequest req) {
        SkillVerificationTask task = taskRepository.findById(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Verification task not found"));

        SkillVerificationSubmission submission = new SkillVerificationSubmission();
        submission.setTask(task);
        submission.setLearner(learner);
        submission.setSubmissionText(req.submissionText());
        submission.setStatus(SubmissionStatus.PENDING);

        return new ApiResponse<>("Submission created", submissionRepository.save(submission));
    }

    @PatchMapping("/submissions/{id}")
    public ApiResponse<SkillVerificationSubmission> reviewSubmission(
            @AuthenticationPrincipal User mentor,
            @PathVariable Long id,
            @RequestBody ReviewSubmissionRequest req) {
        SkillVerificationSubmission submission = submissionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Submission not found"));

        if (!submission.getTask().getMentor().getId().equals(mentor.getId())) {
            throw new IllegalArgumentException("Only task mentor can review submission");
        }

        submission.setStatus(req.status());
        submission.setReviewNote(req.reviewNote());
        SkillVerificationSubmission saved = submissionRepository.save(submission);

        if (req.status() == SubmissionStatus.APPROVED) {
            User learner = submission.getLearner();
            learner.setVerifiedSkills(
                    appendVerifiedSkill(learner.getVerifiedSkills(), submission.getTask().getSkillName()));
            userRepository.save(learner);
        }

        return new ApiResponse<>("Submission reviewed", saved);
    }

    private static String appendVerifiedSkill(String verifiedSkills, String skillName) {
        List<String> skills = new ArrayList<>();
        String existing = verifiedSkills == null ? "" : verifiedSkills.trim();
        if (!existing.isEmpty()) {
            for (String value : existing.split(",")) {
                String trimmed = value.trim();
                if (!trimmed.isEmpty()) {
                    skills.add(trimmed);
                }
            }
        }

        String cleanedSkill = skillName == null ? "" : skillName.trim();
        if (!cleanedSkill.isEmpty()) {
            boolean alreadyExists = skills.stream().anyMatch(skill -> skill.equalsIgnoreCase(cleanedSkill));
            if (!alreadyExists) {
                skills.add(cleanedSkill);
            }
        }

        return String.join(", ", skills);
    }

/**
 * Immutable data carrier for create task request.
 */
    public record CreateTaskRequest(String skillName, String title, String instructions, Boolean active) {
    }

/**
 * Immutable data carrier for submit task request.
 */
    public record SubmitTaskRequest(String submissionText) {
    }

/**
 * Immutable data carrier for review submission request.
 */
    public record ReviewSubmissionRequest(SubmissionStatus status, String reviewNote) {
    }
}
