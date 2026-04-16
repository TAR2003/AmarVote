package com.amarvote.amarvote.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Base64;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.Attachment;
import com.resend.services.emails.model.CreateEmailOptions;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${resend.api.key:}")
    private String resendApiKey;

    @Value("${resend.from.email:AmarVote Team <hello@mail.amarvote2026.me>}")
    private String resendFromEmail;

    // Package-private setter for testing
    void setFromEmail(String fromEmail) {
        this.fromEmail = fromEmail;
    }

    public void sendSignupVerificationEmail(String toEmail, String token) {
        String subject = "📩 Signup Email Verification Code";
        String htmlContent = loadVerificationCodeTemplate(token);

        sendHtmlEmail(toEmail, subject, htmlContent);
    }

    public void sendPasswordResetCodeEmail(String toEmail, String code) {
        String subject = "🔐 Password Reset Verification Code";
        String htmlContent = loadPasswordResetCodeTemplate(code);

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

        if (isResendConfigured()) {
            sendGuardianCredentialEmailWithResend(toEmail, subject, htmlContent, electionTitle, electionId, credentialFilePath);
            return;
        }
        
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8"); // Enable multipart for attachments
            
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true); // Enable HTML
            helper.setFrom(fromEmail);
            
            // Attach the credential file
            FileSystemResource file = new FileSystemResource(credentialFilePath.toFile());
            helper.addAttachment(buildGuardianCredentialFilename(electionTitle, electionId), file);
            
            mailSender.send(message);
            
            System.out.println("✅ Guardian credential email sent successfully to: " + toEmail);
            
        } catch (MessagingException e) {
            System.err.println("❌ Failed to send guardian credential email to " + toEmail + ": " + e.getMessage());
            throw new RuntimeException("Failed to send guardian credential email", e);
        }
    }

    public void sendVoteReceiptEmail(String toEmail, String electionTitle, Long electionId, String receiptContent,
            String trackingCode) {
        String subject = "Your AmarVote Receipt - " + electionTitle;
        String htmlContent = "<p>Your vote was cast successfully.</p>"
                + "<p>Your receipt is attached as a TXT file. Please keep it for verification.</p>"
                + "<p><strong>Tracking Code:</strong> " + trackingCode + "</p>";

        if (isResendConfigured()) {
            sendVoteReceiptEmailWithResend(toEmail, subject, htmlContent, electionTitle, electionId, receiptContent, trackingCode);
            return;
        }

        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);
            helper.setFrom(fromEmail);

            helper.addAttachment(
                    buildVoteReceiptFilename(electionTitle, electionId, trackingCode),
                    new ByteArrayResource(receiptContent.getBytes(StandardCharsets.UTF_8)));

            mailSender.send(message);
        } catch (MessagingException e) {
            throw new RuntimeException("Failed to send vote receipt email", e);
        }
    }

    private void sendHtmlEmail(String toEmail, String subject, String htmlContent) {
        if (isResendConfigured()) {
            sendHtmlEmailWithResend(toEmail, subject, htmlContent);
            return;
        }

        sendHtmlEmailWithSmtp(toEmail, subject, htmlContent);
    }

    private boolean isResendConfigured() {
        return StringUtils.hasText(resendApiKey);
    }

    private void sendHtmlEmailWithResend(String toEmail, String subject, String htmlContent) {
        CreateEmailOptions options = CreateEmailOptions.builder()
                .from(resendFromEmail)
                .to(toEmail)
                .subject(subject)
                .html(htmlContent)
                .build();

        sendWithResend(options, "Failed to send HTML email with Resend");
        }

        private void sendGuardianCredentialEmailWithResend(String toEmail, String subject, String htmlContent,
            String electionTitle, Long electionId, Path credentialFilePath) {
        Attachment attachment = Attachment.builder()
            .fileName(buildGuardianCredentialFilename(electionTitle, electionId))
            .path(credentialFilePath.toString())
            .build();

        CreateEmailOptions options = CreateEmailOptions.builder()
            .from(resendFromEmail)
            .to(toEmail)
            .subject(subject)
            .html(htmlContent)
            .addAttachment(attachment)
            .build();

        sendWithResend(options, "Failed to send guardian credential email with Resend");
        }

        private void sendVoteReceiptEmailWithResend(String toEmail, String subject, String htmlContent,
            String electionTitle, Long electionId, String receiptContent, String trackingCode) {
        Attachment attachment = Attachment.builder()
            .fileName(buildVoteReceiptFilename(electionTitle, electionId, trackingCode))
            .content(Base64.getEncoder().encodeToString(receiptContent.getBytes(StandardCharsets.UTF_8)))
            .build();

        CreateEmailOptions options = CreateEmailOptions.builder()
            .from(resendFromEmail)
            .to(toEmail)
            .subject(subject)
            .html(htmlContent)
            .addAttachment(attachment)
            .build();

        sendWithResend(options, "Failed to send vote receipt email with Resend");
        }

        private void sendWithResend(CreateEmailOptions options, String errorMessage) {
        Resend resend = new Resend(resendApiKey);

        try {
            resend.emails().send(options);
        } catch (ResendException e) {
            throw new RuntimeException(errorMessage, e);
        }
    }

    private void sendHtmlEmailWithSmtp(String toEmail, String subject, String htmlContent) {
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

    private String buildVoteReceiptFilename(String electionTitle, Long electionId, String trackingCode) {
        String safeTitle = sanitizeForFilename(electionTitle);
        String safeTracking = sanitizeForFilename(trackingCode);
        return "vote_receipt_" + safeTitle + "_election_" + electionId + "_" + safeTracking + ".txt";
    }

    private String buildGuardianCredentialFilename(String electionTitle, Long electionId) {
        String safeTitle = sanitizeForFilename(electionTitle);
        return "guardian_credentials_" + safeTitle + "_election_" + electionId + ".txt";
    }

    private String sanitizeForFilename(String input) {
        if (input == null || input.isBlank()) {
            return "unknown";
        }

        String normalized = input.toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("_+", "_")
                .replaceAll("^_|_$", "");

        if (normalized.isBlank()) {
            return "unknown";
        }

        return normalized.length() > 60 ? normalized.substring(0, 60) : normalized;
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

    private String loadPasswordResetCodeTemplate(String code) {
        return "<!DOCTYPE html>" +
                "<html>" +
                "<head>" +
                "    <meta charset='UTF-8'>" +
                "    <style>" +
                "        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }" +
                "        .container { max-width: 600px; margin: 50px auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }" +
                "        .header { text-align: center; margin-bottom: 30px; }" +
                "        .header h1 { color: #2563eb; margin: 0; }" +
                "        .content { text-align: center; }" +
                "        .code { font-size: 36px; font-weight: bold; color: #2563eb; letter-spacing: 10px; margin: 30px 0; padding: 20px; background-color: #eff6ff; border-radius: 8px; }" +
                "        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999999; }" +
                "    </style>" +
                "</head>" +
                "<body>" +
                "    <div class='container'>" +
                "        <div class='header'>" +
                "            <h1>🔐 AmarVote Password Reset</h1>" +
                "        </div>" +
                "        <div class='content'>" +
                "            <p>Use this verification code to reset your password:</p>" +
                "            <div class='code'>" + code + "</div>" +
                "            <p>This code will expire in <strong>10 minutes</strong>.</p>" +
                "            <p>If you did not request a password reset, you can ignore this email.</p>" +
                "        </div>" +
                "        <div class='footer'>" +
                "            <p>© 2026 AmarVote - Secure Online Voting System</p>" +
                "        </div>" +
                "    </div>" +
                "</body>" +
                "</html>";
    }
}
