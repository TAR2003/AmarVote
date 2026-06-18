package com.amarvote.amarvote.email;

/**
 * Abstraction for outbound email delivery (Resend, SMTP/Gmail, etc.).
 */
public interface EmailSender {

    /**
     * @return provider identifier, e.g. {@code resend} or {@code smtp}
     */
    String providerId();

    void send(EmailMessage message);
}
