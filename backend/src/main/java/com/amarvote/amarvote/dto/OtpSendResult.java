package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OtpSendResult {

    public static final String STATUS_SENT = "SENT";
    public static final String STATUS_ALREADY_SENT = "ALREADY_SENT";
    public static final String STATUS_RESENT = "RESENT";

    private boolean success;
    private String status;
    private String message;

    public static OtpSendResult sent(String message) {
        return new OtpSendResult(true, STATUS_SENT, message);
    }

    public static OtpSendResult alreadySent(String message) {
        return new OtpSendResult(true, STATUS_ALREADY_SENT, message);
    }

    public static OtpSendResult resent(String message) {
        return new OtpSendResult(true, STATUS_RESENT, message);
    }

    public static OtpSendResult failed(String message) {
        return new OtpSendResult(false, "FAILED", message);
    }
}
