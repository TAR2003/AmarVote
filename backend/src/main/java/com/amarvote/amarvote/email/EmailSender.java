package com.amarvote.amarvote.email;

import java.util.List;

/**
 * Abstraction for outbound email delivery (Resend, SMTP/Gmail, etc.).
 */
public interface EmailSender {

    /**
     * @return provider identifier, e.g. {@code resend} or {@code smtp}
     */
    String providerId();

    void send(EmailMessage message);

    /**
     * Sends multiple messages in one provider API call when supported.
     * Default implementation falls back to individual sends.
     */
    default void sendBatch(List<EmailMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return;
        }
        for (EmailMessage message : messages) {
            send(message);
        }
    }
}
