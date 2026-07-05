package com.amarvote.amarvote.service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.worker.EmailTask;
import com.amarvote.amarvote.email.EmailAttachment;
import com.amarvote.amarvote.email.EmailBatchDispatcher;
import com.amarvote.amarvote.email.EmailMessage;
import com.amarvote.amarvote.email.EmailQueueType;
import com.amarvote.amarvote.email.ResendEmailSender;

import lombok.RequiredArgsConstructor;

/**
 * Orchestrates email delivery: publishes tasks to RabbitMQ and processes them
 * asynchronously via {@link TaskWorkerService}.
 */
@Service
@RequiredArgsConstructor
public class EmailService {

    private final EmailBatchDispatcher emailBatchDispatcher;
    private final TaskPublisherService taskPublisherService;

    @Value("${amarvote.email.batch-size:100}")
    private int batchSize;

    public void sendSignupVerificationEmail(String toEmail, String token) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
                .emailType(EmailTask.EmailType.SIGNUP_VERIFICATION)
                .toEmail(toEmail)
                .token(token)
                .build());
    }

    public void sendPasswordResetCodeEmail(String toEmail, String code) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
                .emailType(EmailTask.EmailType.PASSWORD_RESET_CODE)
                .toEmail(toEmail)
                .code(code)
                .build());
    }

    public void sendForgotPasswordEmail(String toEmail, String resetLink) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
                .emailType(EmailTask.EmailType.FORGOT_PASSWORD)
                .toEmail(toEmail)
                .resetLink(resetLink)
                .build());
    }

    public void sendGuardianPrivateKeyEmail(String toEmail, String electionTitle, String electionDescription, String privateKey, Long electionId) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
                .emailType(EmailTask.EmailType.GUARDIAN_PRIVATE_KEY)
                .toEmail(toEmail)
                .electionTitle(electionTitle)
                .electionDescription(electionDescription)
                .privateKey(privateKey)
                .electionId(electionId)
                .build());
    }

    public void sendOtpEmail(String toEmail, String otpCode) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
                .emailType(EmailTask.EmailType.OTP)
                .toEmail(toEmail)
                .code(otpCode)
                .build());
    }

    public void sendGuardianCredentialEmail(String toEmail, String electionTitle, String electionDescription, Path credentialFilePath, Long electionId) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
                .emailType(EmailTask.EmailType.GUARDIAN_CREDENTIAL)
                .toEmail(toEmail)
                .electionTitle(electionTitle)
                .electionDescription(electionDescription)
                .electionId(electionId)
                .credentialFilePath(credentialFilePath == null ? null : credentialFilePath.toString())
                .build());
    }

    public void sendReminderEmail(String toEmail, String subject, String htmlContent) {
        sendBulkReminderEmail(List.of(toEmail), subject, htmlContent);
    }

    /**
     * Queues recipients for the bulk email lane. Messages are batched (up to 100) and
     * sent at 1 Resend API request/second by {@link EmailBatchDispatcher}.
     */
    public void sendBulkReminderEmail(List<String> toEmails, String subject, String htmlContent) {
        if (toEmails == null || toEmails.isEmpty()) {
            return;
        }

        int chunkSize = Math.min(Math.max(batchSize, 1), ResendEmailSender.MAX_BATCH_SIZE);
        for (int index = 0; index < toEmails.size(); index += chunkSize) {
            List<String> chunk = new ArrayList<>(
                    toEmails.subList(index, Math.min(index + chunkSize, toEmails.size())));

            taskPublisherService.publishEmailTask(EmailTask.builder()
                    .emailType(EmailTask.EmailType.BATCH_REMINDER)
                    .toEmails(chunk)
                    .subject(subject)
                    .htmlContent(htmlContent)
                    .build());
        }
    }

    public void sendVoteReceiptEmail(String toEmail, String electionTitle, Long electionId, String receiptContent,
            String trackingCode) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
            .emailType(EmailTask.EmailType.VOTE_RECEIPT)
            .toEmail(toEmail)
            .electionTitle(electionTitle)
            .electionId(electionId)
            .receiptContent(receiptContent)
            .trackingCode(trackingCode)
            .build());
    }

    /**
     * Called by the RabbitMQ email worker — builds messages and buffers them for batched delivery.
     */
    public void processEmailTask(EmailTask task) {
        if (task == null || task.getEmailType() == null) {
            throw new IllegalArgumentException("Email task or type is missing");
        }

        EmailQueueType queueType = TaskPublisherService.resolveEmailQueueType(task);

        switch (task.getEmailType()) {
            case SIGNUP_VERIFICATION -> emailBatchDispatcher.enqueue(
                    queueType,
                    htmlMessage(task.getToEmail(), "📩 Signup Email Verification Code", loadVerificationCodeTemplate(task.getToken())),
                    task);
            case PASSWORD_RESET_CODE -> emailBatchDispatcher.enqueue(
                    queueType,
                    htmlMessage(task.getToEmail(), "🔐 Password Reset Verification Code", loadPasswordResetCodeTemplate(task.getCode())),
                    task);
            case FORGOT_PASSWORD -> emailBatchDispatcher.enqueue(
                    queueType,
                    htmlMessage(task.getToEmail(), "🔐 Password Reset Request", loadResetPasswordTemplate(task.getResetLink())),
                    task);
            case GUARDIAN_PRIVATE_KEY -> emailBatchDispatcher.enqueue(
                    queueType,
                    htmlMessage(
                            task.getToEmail(),
                            "🛡️ Your Guardian Private Key for Election: " + task.getElectionTitle(),
                            loadGuardianPrivateKeyTemplate(
                                    task.getElectionTitle(),
                                    task.getElectionDescription(),
                                    task.getPrivateKey(),
                                    task.getElectionId())),
                    task);
            case GUARDIAN_CREDENTIAL -> emailBatchDispatcher.enqueue(
                    queueType,
                    guardianCredentialMessage(task),
                    task);
            case OTP -> emailBatchDispatcher.enqueue(
                    queueType,
                    htmlMessage(task.getToEmail(), "🔐 Your AmarVote Login Code", loadOtpEmailTemplate(task.getCode())),
                    task);
            case VOTE_RECEIPT -> emailBatchDispatcher.enqueue(
                    queueType,
                    voteReceiptMessage(task),
                    task);
            case REMINDER -> {
                String html = task.getHtmlContent() == null ? "" : task.getHtmlContent().replace("\n", "<br/>");
                emailBatchDispatcher.enqueue(
                        queueType,
                        htmlMessage(task.getToEmail(), task.getSubject(), html),
                        task);
            }
            case BATCH_REMINDER -> emailBatchDispatcher.enqueueAll(
                    queueType,
                    batchReminderMessages(task.getToEmails(), task.getSubject(), task.getHtmlContent()),
                    task);
            default -> throw new IllegalArgumentException("Unsupported email task type: " + task.getEmailType());
        }
    }

    private EmailMessage htmlMessage(String toEmail, String subject, String htmlContent) {
        return EmailMessage.builder()
                .to(toEmail)
                .subject(subject)
                .htmlContent(htmlContent)
                .build();
    }

    private EmailMessage guardianCredentialMessage(EmailTask task) {
        if (task.getCredentialFilePath() == null) {
            throw new IllegalArgumentException("Credential file path is required for guardian credential email");
        }

        return EmailMessage.builder()
                .to(task.getToEmail())
                .subject("🛡️ Your Guardian Credentials for Election: " + task.getElectionTitle())
                .htmlContent(loadGuardianCredentialTemplate(
                        task.getElectionTitle(),
                        task.getElectionDescription(),
                        task.getElectionId()))
                .attachment(EmailAttachment.fromFile(
                        buildGuardianCredentialFilename(task.getElectionTitle(), task.getElectionId()),
                        Path.of(task.getCredentialFilePath())))
                .build();
    }

    private EmailMessage voteReceiptMessage(EmailTask task) {
        String htmlContent = "<p>Your vote was cast successfully.</p>"
                + "<p>Your receipt is attached as a TXT file. Please keep it for verification.</p>"
                + "<p><strong>Tracking Code:</strong> " + task.getTrackingCode() + "</p>";

        return EmailMessage.builder()
                .to(task.getToEmail())
                .subject("Your AmarVote Receipt - " + task.getElectionTitle())
                .htmlContent(htmlContent)
                .attachment(EmailAttachment.fromContent(
                        buildVoteReceiptFilename(
                                task.getElectionTitle(),
                                task.getElectionId(),
                                task.getTrackingCode()),
                        task.getReceiptContent().getBytes(StandardCharsets.UTF_8)))
                .build();
    }

    private List<EmailMessage> batchReminderMessages(List<String> toEmails, String subject, String rawContent) {
        if (toEmails == null || toEmails.isEmpty()) {
            return List.of();
        }

        String html = rawContent == null ? "" : rawContent.replace("\n", "<br/>");
        List<EmailMessage> messages = new ArrayList<>(toEmails.size());
        for (String toEmail : toEmails) {
            messages.add(htmlMessage(toEmail, subject, html));
        }
        return messages;
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
