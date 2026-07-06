ALTER TABLE users
ADD COLUMN message_privacy VARCHAR(50) NOT NULL DEFAULT 'ANYONE';

CREATE TABLE message_requests (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT NOT NULL,
    receiver_id BIGINT NOT NULL,
    first_message TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_message_requests_sender FOREIGN KEY (sender_id) REFERENCES users(id),
    CONSTRAINT fk_message_requests_receiver FOREIGN KEY (receiver_id) REFERENCES users(id)
);

CREATE INDEX idx_message_requests_receiver_status ON message_requests(receiver_id, status);
CREATE INDEX idx_message_requests_sender_receiver ON message_requests(sender_id, receiver_id);

CREATE TABLE direct_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    participant_one_id BIGINT NOT NULL,
    participant_two_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_direct_conversations_participant_one FOREIGN KEY (participant_one_id) REFERENCES users(id),
    CONSTRAINT fk_direct_conversations_participant_two FOREIGN KEY (participant_two_id) REFERENCES users(id)
);

CREATE TABLE direct_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    conversation_id BIGINT NOT NULL,
    sender_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_direct_messages_conversation FOREIGN KEY (conversation_id) REFERENCES direct_conversations(id),
    CONSTRAINT fk_direct_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id)
);

CREATE INDEX idx_direct_messages_conversation ON direct_messages(conversation_id, created_at);
