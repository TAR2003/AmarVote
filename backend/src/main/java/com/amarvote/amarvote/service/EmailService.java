package com.amarvote.amarvote.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendSignupVerificationEmail(String toEmail, String token) {
        String subject = "Signup Email Verification Code";
        String message = "Welcome! Your signup verification code is: " + token + "\n\nThis code will expire in 10 minutes.";
        sendPlainTextEmail(toEmail, subject, message);
    }

    public void sendForgotPasswordEmail(String toEmail, String resetLink) {
        String subject = "🔐 Password Reset Request";
        String htmlContent = loadResetPasswordTemplate(resetLink);

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true); // true enables HTML
            helper.setFrom("amarvote2025@gmail.com");

            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send HTML email", e);
        }
    }

    private void sendPlainTextEmail(String toEmail, String subject, String message) {
        MimeMessage mimeMessage = mailSender.createMimeMessage();
        try {
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, false, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(message, false);
            helper.setFrom("your_email@gmail.com");

            mailSender.send(mimeMessage);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send plain text email", e);
        }
    }

    private String loadResetPasswordTemplate(String resetLink) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/resetpasswordemail.html");
            String html = new String(Files.readAllBytes(resource.getFile().toPath()), StandardCharsets.UTF_8);
            return html.replace("{{RESET_LINK}}", resetLink);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load reset password email template", e);
        }
    }
}
