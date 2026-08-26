package com.mentorly.messaging;

import com.mentorly.common.ApiResponse;
import com.mentorly.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * REST controller exposing message privacy endpoints.
 */
@RestController
@RequestMapping("/api/settings/message-privacy")
@RequiredArgsConstructor
public class MessagePrivacyController {

    private final MessagePrivacyService messagePrivacyService;

    @GetMapping
    public ApiResponse<MessagePrivacyResponse> get(@AuthenticationPrincipal User currentUser) {
        return new ApiResponse<>("Messaging privacy fetched", messagePrivacyService.get(currentUser));
    }

    @PutMapping
    public ApiResponse<MessagePrivacyResponse> update(@AuthenticationPrincipal User currentUser,
            @RequestBody MessagePrivacyRequest request) {
        return new ApiResponse<>("Messaging privacy updated",
                messagePrivacyService.update(currentUser, request.privacy()));
    }

/**
 * Immutable data carrier for message privacy request.
 */
    public record MessagePrivacyRequest(MessagePrivacy privacy) {
    }

/**
 * Immutable data carrier for message privacy response.
 */
    public record MessagePrivacyResponse(String privacy) {
        public static MessagePrivacyResponse from(MessagePrivacy privacy) {
            return new MessagePrivacyResponse(privacy == null ? MessagePrivacy.ANYONE.name() : privacy.name());
        }
    }
}
