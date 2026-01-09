package com.amarvote.amarvote.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
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

    // Package-private setter for testing
    void setFromEmail(String fromEmail) {
        this.fromEmail = fromEmail;
    }

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

    public void sendGuardianPrivateKeyEmail(String toEmail, String electionTitle, String electionDescription, String privateKey, Long electionId) {
        String subject = "🛡️ Your Guardian Private Key for Election: " + electionTitle;
        String htmlContent = loadGuardianPrivateKeyTemplate(electionTitle, electionDescription, privateKey, electionId);
        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    public void sendOtpEmail(String toEmail, String otpCode) {
        String subject = "🔐 Your AmarVote Login Code";
        String htmlContent = loadOtpEmailTemplate(otpCode);
        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    /**
     * Send guardian credential file via email with secure attachment
     * @param toEmail Guardian's email address
     * @param electionTitle Election title
     * @param electionDescription Election description  
     * @param credentialFilePath Path to the credential file containing encrypted data
     * @param electionId Election ID
     */
    public void sendGuardianCredentialEmail(String toEmail, String electionTitle, String electionDescription, Path credentialFilePath, Long electionId) {
        String subject = "🛡️ Your Guardian Credentials for Election: " + electionTitle;
        String htmlContent = loadGuardianCredentialTemplate(electionTitle, electionDescription, electionId);
        
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8"); // Enable multipart for attachments
            
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true); // Enable HTML
            helper.setFrom(fromEmail);
            
            // Attach the credential file
            FileSystemResource file = new FileSystemResource(credentialFilePath.toFile());
            helper.addAttachment("credentials.txt", file);
            
            mailSender.send(message);
            
            System.out.println("✅ Guardian credential email sent successfully to: " + toEmail);
            
        } catch (MessagingException e) {
            System.err.println("❌ Failed to send guardian credential email to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Failed to send guardian credential email", e);
        }
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
            String html = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            return html.replace("{{RESET_LINK}}", resetLink);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load reset password email template", e);
        }
    }

    private String loadVerificationCodeTemplate(String code) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/verificationcodeemail.html");
            String html = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            return html.replace("{{VERIFICATION_CODE}}", code);
        } catch (IOException e) {
            throw new RuntimeException("Failed to load verification code email template", e);
        }
    }

    private String loadGuardianPrivateKeyTemplate(String electionTitle, String electionDescription, String privateKey, Long electionId) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/GuardianPrivateKeyEmail.html");
            String html = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            html = html.replace("{{ELECTION_TITLE}}", electionTitle);
            html = html.replace("{{ELECTION_DESCRIPTION}}", electionDescription != null ? electionDescription : "");
            html = html.replace("{{PRIVATE_KEY}}", privateKey);
            html = html.replace("{{ELECTION_ID}}", electionId.toString());
            return html;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load guardian private key email template", e);
        }
    }

    private String loadGuardianCredentialTemplate(String electionTitle, String electionDescription, Long electionId) {
        try {
            ClassPathResource resource = new ClassPathResource("templates/GuardianCredentialEmail.html");
            String html = new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            html = html.replace("{{ELECTION_TITLE}}", electionTitle);
            html = html.replace("{{ELECTION_DESCRIPTION}}", electionDescription != null ? electionDescription : "");
            html = html.replace("{{ELECTION_ID}}", electionId.toString());
            return html;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load guardian credential email template", e);
        }
    }

    private String loadOtpEmailTemplate(String otpCode) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head>" +
                "    <meta charset='UTF-8'>" +
                "    <style>" +
                "        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }" +
                "        .container { max-width: 600px; margin: 50px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }" +
                "        .header { text-align: center; margin-bottom: 30px; }" +
                "        .header h1 { color: #4CAF50; margin: 0; }" +
                "        .content { text-align: center; }" +
                "        .otp-code { font-size: 36px; font-weight: bold; color: #4CAF50; letter-spacing: 10px; margin: 30px 0; padding: 20px; background-color: #f9f9f9; border-radius: 8px; }" +
                "        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999999; }" +
                "    </style>" +
                "</head>" +
                "<body>" +
                "    <div class='container'>" +
                "        <div class='header'>" +
                "            <h1>🔐 AmarVote Login</h1>" +
                "        </div>" +
                "        <div class='content'>" +
                "            <p>Your one-time login code is:</p>" +
                "            <div class='otp-code'>" + otpCode + "</div>" +
                "            <p>This code will expire in <strong>5 minutes</strong>.</p>" +
                "            <p>If you did not request this code, please ignore this email.</p>" +
                "        </div>" +
                "        <div class='footer'>" +
                "            <p>© 2026 AmarVote - Secure Online Voting System</p>" +
                "        </div>" +
                "    </div>" +
                "</body>" +
                "</html>";
    }
}
