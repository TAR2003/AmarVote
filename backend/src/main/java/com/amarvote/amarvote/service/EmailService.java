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
import org.springframework.web.util.HtmlUtils;

import com.amarvote.amarvote.dto.worker.EmailTask;
import com.amarvote.amarvote.email.EmailAttachment;
import com.amarvote.amarvote.email.EmailBatchDispatcher;
import com.amarvote.amarvote.email.EmailMessage;
import com.amarvote.amarvote.email.EmailQueueType;
import com.amarvote.amarvote.email.ResendEmailSender;
import com.amarvote.amarvote.util.SiteUrlResolver;

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
    private final SiteUrlResolver siteUrlResolver;

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

    public void sendVoteReceiptEmail(
            String toEmail,
            String electionTitle,
            Long electionId,
            String receiptContent,
            String trackingCode,
            String receiptDownloadToken) {
        taskPublisherService.publishEmailTask(EmailTask.builder()
            .emailType(EmailTask.EmailType.VOTE_RECEIPT)
            .toEmail(toEmail)
            .electionTitle(electionTitle)
            .electionId(electionId)
            .receiptContent(receiptContent)
            .trackingCode(trackingCode)
            .receiptDownloadToken(receiptDownloadToken)
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
                String html = wrapBrandedBody(
                        "Election Update",
                        toBrandedBodyHtml(task.getHtmlContent()));
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
        String plaintext = task.getReceiptContent() == null ? "" : task.getReceiptContent();
        String escapedPlaintext = HtmlUtils.htmlEscape(plaintext);
        String downloadUrl = buildReceiptDownloadUrl(task);

        String htmlContent = """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="UTF-8">
                  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                </head>
                <body style="margin:0;padding:0;background:#efebf8;font-family:Inter,Helvetica,Arial,sans-serif;color:#1b1d2e;">
                  <div style="width:100%%;background:#efebf8;padding:40px 16px;">
                    <div style="max-width:560px;margin:0 auto;background:#f7f4ec;border:1px solid rgba(27,29,46,0.12);border-radius:12px;overflow:hidden;">
                      <div style="height:4px;background:#8b7fe8;"></div>
                      <div style="padding:28px 32px 8px;text-align:center;">
                        <p style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-size:28px;font-weight:600;color:#5c52c4;letter-spacing:-0.02em;margin:0;">AmarVote</p>
                      </div>
                      <div style="padding:8px 32px 32px;line-height:1.6;font-size:16px;color:#1b1d2e;">
                        <h2 style="font-family:Fraunces,Georgia,'Times New Roman',serif;font-size:22px;font-weight:500;color:#12142b;text-align:center;margin:16px 0 20px;">Your Vote Receipt</h2>
                        <p>Your vote was cast successfully. Please save this receipt for verification.</p>
                        <pre style="background:#ffffff;border:1px solid rgba(27,29,46,0.12);border-radius:8px;padding:16px; \
                white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.5;color:#1b1d2e;font-family:'Courier New',Courier,monospace;">%s</pre>
                        <p style="margin-top:24px;text-align:center;">
                          <a href="%s" style="display:inline-block;background:#5c52c4;color:#f7f4ec; \
                text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;font-family:Inter,Helvetica,Arial,sans-serif;">
                            Download TXT Receipt
                          </a>
                        </p>
                        <p style="font-size:12px;color:#5b5d74;margin-top:16px;text-align:center;">
                          This secure link expires in 30 days. Do not share it — anyone with the link can download this receipt.
                        </p>
                      </div>
                      <div style="text-align:center;font-size:13px;color:#5b5d74;padding:0 32px 28px;">
                        &copy; 2026 AmarVote. All rights reserved.
                      </div>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(escapedPlaintext, HtmlUtils.htmlEscape(downloadUrl));

        return EmailMessage.builder()
                .to(task.getToEmail())
                .subject("Your AmarVote Receipt - " + task.getElectionTitle())
                .htmlContent(htmlContent)
                .build();
    }

    private String buildReceiptDownloadUrl(EmailTask task) {
        if (task.getReceiptDownloadToken() == null || task.getReceiptDownloadToken().isBlank()) {
            throw new IllegalArgumentException("Receipt download token is required");
        }

        String base = task.getSiteBaseUrl();
        if (base == null || base.isBlank()) {
            base = siteUrlResolver.getConfiguredBaseUrl();
        }
        if (base == null || base.isBlank()) {
            throw new IllegalStateException(
                    "Cannot build receipt download URL: no site URL from vote request and PUBLIC_BASE_URL is not set");
        }

        return base + "/receipt/download?token=" + task.getReceiptDownloadToken();
    }

    private List<EmailMessage> batchReminderMessages(List<String> toEmails, String subject, String rawContent) {
        if (toEmails == null || toEmails.isEmpty()) {
            return List.of();
        }

        String html = wrapBrandedBody("Election Update", toBrandedBodyHtml(rawContent));
        List<EmailMessage> messages = new ArrayList<>(toEmails.size());
        for (String toEmail : toEmails) {
            messages.add(htmlMessage(toEmail, subject, html));
        }
        return messages;
    }

    /**
     * Admin-authored reminder text → safe HTML paragraphs for the branded shell.
     * Escapes HTML so operators cannot inject markup; newlines become breaks.
     */
    private String toBrandedBodyHtml(String rawContent) {
        if (rawContent == null || rawContent.isBlank()) {
            return "<p>You have an update from AmarVote.</p>";
        }
        String escaped = HtmlUtils.htmlEscape(rawContent);
        return "<p style=\"margin:0;white-space:pre-wrap;\">" + escaped.replace("\n", "<br/>") + "</p>";
    }

    /**
     * Shared AmarVote email chrome: glacier backdrop, frost card, Fraunces wordmark, brand accent.
     * Body content is injected as HTML (already escaped for user-authored text).
     */
    private String wrapBrandedBody(String title, String bodyHtml) {
        return "<!DOCTYPE html>" +
                "<html lang='en'>" +
                "<head>" +
                "  <meta charset='UTF-8'>" +
                "  <meta name='viewport' content='width=device-width, initial-scale=1.0'>" +
                "  <link href='https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>" +
                "  <style>" +
                "    body { margin:0; padding:0; background:#efebf8; font-family:Inter,Helvetica,Arial,sans-serif; color:#1b1d2e; -webkit-font-smoothing:antialiased; }" +
                "    .outer { width:100%; background:#efebf8; padding:40px 16px; }" +
                "    .card { max-width:560px; margin:0 auto; background:#f7f4ec; border:1px solid rgba(27,29,46,0.12); border-radius:12px; overflow:hidden; }" +
                "    .accent { height:4px; background:#8b7fe8; }" +
                "    .header { padding:28px 32px 8px; text-align:center; }" +
                "    .wordmark { font-family:Fraunces,Georgia,'Times New Roman',serif; font-size:28px; font-weight:600; color:#5c52c4; letter-spacing:-0.02em; margin:0; }" +
                "    .content { padding:8px 32px 32px; line-height:1.6; font-size:16px; color:#1b1d2e; }" +
                "    .content h2 { font-family:Fraunces,Georgia,'Times New Roman',serif; font-size:22px; font-weight:500; color:#12142b; text-align:center; margin:16px 0 20px; }" +
                "    .footer { text-align:center; font-size:13px; color:#5b5d74; padding:0 32px 28px; }" +
                "  </style>" +
                "</head>" +
                "<body>" +
                "  <div class='outer'><div class='card'>" +
                "    <div class='accent'></div>" +
                "    <div class='header'><p class='wordmark'>AmarVote</p></div>" +
                "    <div class='content'>" +
                "      <h2>" + HtmlUtils.htmlEscape(title) + "</h2>" +
                "      " + bodyHtml +
                "    </div>" +
                "    <div class='footer'>&copy; 2026 AmarVote. All rights reserved.</div>" +
                "  </div></div>" +
                "</body>" +
                "</html>";
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
            html = html.replace("{{SITE_BASE_URL}}", resolveSiteBaseUrl());
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
            html = html.replace("{{SITE_BASE_URL}}", resolveSiteBaseUrl());
            return html;
        } catch (IOException e) {
            throw new RuntimeException("Failed to load guardian credential email template", e);
        }
    }

    private String resolveSiteBaseUrl() {
        String base = siteUrlResolver.getConfiguredBaseUrl();
        if (base == null || base.isBlank()) {
            // Match production host when PUBLIC_BASE_URL is unset (local / legacy deploys)
            return "https://amarvote2026.me";
        }
        return base;
    }

    private String loadOtpEmailTemplate(String otpCode) {
        return brandedCodeEmail(
                "Login Code",
                "Your one-time login code is:",
                otpCode,
                "This code will expire in <strong>5 minutes</strong>.",
                "If you did not request this code, please ignore this email.");
    }

    private String loadPasswordResetCodeTemplate(String code) {
        return brandedCodeEmail(
                "Password Reset",
                "Use this verification code to reset your password:",
                code,
                "This code will expire in <strong>10 minutes</strong>.",
                "If you did not request a password reset, you can ignore this email.");
    }

    private String brandedCodeEmail(String title, String lead, String code, String expiryLine, String ignoreLine) {
        return "<!DOCTYPE html>" +
                "<html lang='en'>" +
                "<head>" +
                "  <meta charset='UTF-8'>" +
                "  <link href='https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&display=swap' rel='stylesheet'>" +
                "  <style>" +
                "    body { margin:0; padding:0; background:#efebf8; font-family:Inter,Helvetica,Arial,sans-serif; color:#1b1d2e; }" +
                "    .outer { width:100%; background:#efebf8; padding:40px 16px; }" +
                "    .card { max-width:560px; margin:0 auto; background:#f7f4ec; border:1px solid rgba(27,29,46,0.12); border-radius:12px; overflow:hidden; }" +
                "    .accent { height:4px; background:#8b7fe8; }" +
                "    .header { padding:28px 32px 8px; text-align:center; }" +
                "    .wordmark { font-family:Fraunces,Georgia,'Times New Roman',serif; font-size:28px; font-weight:600; color:#5c52c4; letter-spacing:-0.02em; margin:0; }" +
                "    .content { padding:8px 32px 32px; line-height:1.6; font-size:16px; color:#1b1d2e; text-align:center; }" +
                "    .content h2 { font-family:Fraunces,Georgia,'Times New Roman',serif; font-size:22px; font-weight:500; color:#12142b; margin:16px 0 20px; }" +
                "    .code { font-size:32px; font-weight:700; color:#5c52c4; letter-spacing:8px; margin:24px 0; padding:20px; background:#efebf8; border-radius:10px; border:1px solid rgba(92,82,196,0.25); }" +
                "    .footer { text-align:center; font-size:13px; color:#5b5d74; padding:0 32px 28px; }" +
                "  </style>" +
                "</head>" +
                "<body>" +
                "  <div class='outer'><div class='card'>" +
                "    <div class='accent'></div>" +
                "    <div class='header'><p class='wordmark'>AmarVote</p></div>" +
                "    <div class='content'>" +
                "      <h2>" + title + "</h2>" +
                "      <p>" + lead + "</p>" +
                "      <div class='code'>" + code + "</div>" +
                "      <p>" + expiryLine + "</p>" +
                "      <p>" + ignoreLine + "</p>" +
                "    </div>" +
                "    <div class='footer'>&copy; 2026 AmarVote. All rights reserved.</div>" +
                "  </div></div>" +
                "</body>" +
                "</html>";
    }
}
