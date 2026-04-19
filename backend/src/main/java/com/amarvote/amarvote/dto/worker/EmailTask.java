package com.amarvote.amarvote.dto.worker;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Generic queued email payload for all outgoing emails.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EmailTask implements Serializable {

    public enum EmailType {
        SIGNUP_VERIFICATION,
        PASSWORD_RESET_CODE,
        FORGOT_PASSWORD,
        GUARDIAN_PRIVATE_KEY,
        GUARDIAN_CREDENTIAL,
        OTP,
        VOTE_RECEIPT,
        REMINDER
    }

    private EmailType emailType;
    private String toEmail;

    private String token;
    private String code;
    private String resetLink;

    private String electionTitle;
    private String electionDescription;
    private String privateKey;
    private Long electionId;

    private String credentialFilePath;

    private String trackingCode;
    private String receiptContent;

    private String subject;
    private String htmlContent;
}