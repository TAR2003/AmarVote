package com.amarvote.amarvote.email;

import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.Attachment;
import com.resend.services.emails.model.CreateEmailOptions;

@Component
public class ResendEmailSender implements EmailSender {

    public static final int MAX_BATCH_SIZE = 100;

    private final String apiKey;
    private final String fromEmail;
    private final Resend resend;

    public ResendEmailSender(
            @Value("${resend.api.key:}") String apiKey,
            @Value("${resend.from.email:AmarVote Team <noreply@mail.amarvote2026.me>}") String fromEmail) {
        this.apiKey = apiKey;
        this.fromEmail = fromEmail;
        this.resend = StringUtils.hasText(apiKey) ? new Resend(apiKey) : null;
    }

    public boolean isConfigured() {
        return resend != null;
    }

    @Override
    public String providerId() {
        return "resend";
    }

    @Override
    public void send(EmailMessage message) {
        requireConfigured();
        try {
            resend.emails().send(toCreateEmailOptions(message));
        } catch (ResendException e) {
            throw new RuntimeException("Failed to send email via Resend", e);
        }
    }

    @Override
    public void sendBatch(List<EmailMessage> messages) {
        requireConfigured();
        if (messages == null || messages.isEmpty()) {
            return;
        }
        if (messages.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("Resend batch send supports at most " + MAX_BATCH_SIZE + " emails");
        }

        List<CreateEmailOptions> options = new ArrayList<>(messages.size());
        for (EmailMessage message : messages) {
            if (!message.getAttachments().isEmpty()) {
                throw new IllegalArgumentException("Resend batch send does not support attachments");
            }
            options.add(toCreateEmailOptions(message));
        }

        try {
            resend.batch().send(options);
        } catch (ResendException e) {
            throw new RuntimeException("Failed to send email batch via Resend", e);
        }
    }

    private CreateEmailOptions toCreateEmailOptions(EmailMessage message) {
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

        return optionsBuilder.build();
    }

    private void requireConfigured() {
        if (!isConfigured()) {
            throw new IllegalStateException("Resend API key is not configured");
        }
    }
}
