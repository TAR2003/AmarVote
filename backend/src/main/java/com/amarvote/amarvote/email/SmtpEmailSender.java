package com.amarvote.amarvote.email;

import java.nio.charset.StandardCharsets;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Component
public class SmtpEmailSender implements EmailSender {

    private final JavaMailSender mailSender;
    private final String fromEmail;

    public SmtpEmailSender(
            JavaMailSender mailSender,
            @Value("${spring.mail.username}") String fromEmail) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
    }

    @Override
    public String providerId() {
        return "smtp";
    }

    @Override
    public void send(EmailMessage message) {
        try {
            boolean multipart = !message.getAttachments().isEmpty();
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, multipart, StandardCharsets.UTF_8.name());

            helper.setTo(message.getTo());
            helper.setSubject(message.getSubject());
            helper.setText(message.getHtmlContent(), true);
            helper.setFrom(fromEmail);

            for (EmailAttachment attachment : message.getAttachments()) {
                if (attachment.getContent() != null) {
                    helper.addAttachment(
                            attachment.getFileName(),
                            new ByteArrayResource(attachment.getContent()));
                } else if (attachment.getFilePath() != null) {
                    helper.addAttachment(
                            attachment.getFileName(),
                            new FileSystemResource(attachment.getFilePath().toFile()));
                }
            }

            mailSender.send(mimeMessage);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send email via SMTP", e);
        }
    }

    @Override
    public void sendBatch(List<EmailMessage> messages) {
        for (EmailMessage message : messages) {
            send(message);
        }
    }
}
