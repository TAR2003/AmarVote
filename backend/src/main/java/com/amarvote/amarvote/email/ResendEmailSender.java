package com.amarvote.amarvote.email;

import java.util.Base64;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.Attachment;
import com.resend.services.emails.model.CreateEmailOptions;

@Component
public class ResendEmailSender implements EmailSender {

    private final String apiKey;
    private final String fromEmail;

    public ResendEmailSender(
            @Value("${resend.api.key:}") String apiKey,
            @Value("${resend.from.email:AmarVote Team <noreply@mail.amarvote2026.me>}") String fromEmail) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
    }

    public boolean isConfigured() {
        return StringUtils.hasText(apiKey);
    }

    @Override
    public String providerId() {
        return "resend";
    }

    @Override
    public void send(EmailMessage message) {
        if (!isConfigured()) {
            throw new IllegalStateException("Resend API key is not configured");
        }

        CreateEmailOptions.Builder optionsBuilder = CreateEmailOptions.builder()
                .from(fromEmail)
                .to(message.getTo())
                .subject(message.getSubject())
                .html(message.getHtmlContent());

        for (EmailAttachment attachment : message.getAttachments()) {
            Attachment.Builder attachmentBuilder = Attachment.builder()
                    .fileName(attachment.getFileName());

            if (attachment.getContent() != null) {
                attachmentBuilder.content(
                        Base64.getEncoder().encodeToString(attachment.getContent()));
            } else if (attachment.getFilePath() != null) {
                attachmentBuilder.path(attachment.getFilePath().toString());
            }

            optionsBuilder.addAttachment(attachmentBuilder.build());
        }

        Resend resend = new Resend(apiKey);
        try {
            resend.emails().send(optionsBuilder.build());
        } catch (ResendException e) {
            throw new RuntimeException("Failed to send email via Resend", e);
        }
    }
}
