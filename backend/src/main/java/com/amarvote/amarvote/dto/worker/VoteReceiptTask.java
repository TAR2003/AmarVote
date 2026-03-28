package com.amarvote.amarvote.dto.worker;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Task payload for asynchronous vote receipt email delivery.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VoteReceiptTask implements Serializable {
    private Long electionId;
    private String electionTitle;
    private String voterEmail;
    private String trackingCode;
    private String hashCode;
    private String receiptContent;
}
