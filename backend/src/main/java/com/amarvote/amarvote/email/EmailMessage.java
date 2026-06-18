package com.amarvote.amarvote.email;

import java.util.Collections;
import java.util.List;

import lombok.Builder;
import lombok.Singular;
import lombok.Value;

@Value
@Builder
public class EmailMessage {
    String to;
    String subject;
    String htmlContent;

    @Singular
    List<EmailAttachment> attachments;

    public List<EmailAttachment> getAttachments() {
        return attachments == null ? Collections.emptyList() : attachments;
    }
}
