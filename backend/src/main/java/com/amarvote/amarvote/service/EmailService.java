package com.amarvote.amarvote.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    public void sendSignupVerificationEmail(String toEmail, String token) {
        String subject = "📩 Signup Email Verification Code";
        String htmlContent = loadVerificationCodeTemplate(token);

        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    public void sendForgotPasswordEmail(String toEmail, String resetLink) {
        String subject = "🔐 Password Reset Request";
        String htmlContent = loadResetPasswordTemplate(resetLink);

        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    public void sendGuardianPrivateKeyEmail(String toEmail, String electionTitle, String privateKey) {
        String subject = "🛡️ Your Guardian Private Key for Election: " + electionTitle;
        String htmlContent = loadGuardianPrivateKeyTemplate(electionTitle, privateKey);
        sendHtmlEmail(toEmail, subject, htmlContent);
    }


    private void sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true); // Enable HTML
            helper.setFrom(fromEmail);

            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send HTML email", e);
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

    private String loadVerificationCodeTemplate(String code) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/verificationcodeemail.html");
            String html = new String(Files.readAllBytes(resource.getFile().toPath()), StandardCharsets.UTF_8);
            return html.replace("{{VERIFICATION_CODE}}", code);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load verification code email template", e);
        }
    }

    private String loadGuardianPrivateKeyTemplate(String electionTitle, String privateKey) {
    try {
        ClassPathResource resource = new ClassPathResource("templates/GuardianPrivateKeyEmail.html");
        String html = new String(Files.readAllBytes(resource.getFile().toPath()), StandardCharsets.UTF_8);
        html = html.replace("{{ELECTION_TITLE}}", electionTitle);
        html = html.replace("{{PRIVATE_KEY}}", privateKey);
        return html;
    } catch (IOException e) {
        throw new RuntimeException("Failed to load guardian private key email template", e);
    }
}
}
