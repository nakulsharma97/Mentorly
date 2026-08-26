package com.mentorly.messaging;

import com.mentorly.user.User;
import com.mentorly.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service implementing message privacy business logic.
 */
@Service
@RequiredArgsConstructor
public class MessagePrivacyService {

    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public MessagePrivacyController.MessagePrivacyResponse get(User currentUser) {
        return MessagePrivacyController.MessagePrivacyResponse.from(currentUser.getMessagePrivacy());
    }

    @Transactional
    public MessagePrivacyController.MessagePrivacyResponse update(User currentUser, MessagePrivacy privacy) {
        if (privacy == null) {
            privacy = MessagePrivacy.ANYONE;
        }
        currentUser.setMessagePrivacy(privacy);
        userRepository.save(currentUser);
        return MessagePrivacyController.MessagePrivacyResponse.from(privacy);
    }
}
