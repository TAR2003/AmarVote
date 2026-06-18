package com.amarvote.amarvote.email;

import java.nio.file.Path;

import lombok.Builder;
import lombok.Value;

/**
 * Email attachment — either inline content or a file on disk.
 */
@Value
@Builder
public class EmailAttachment {
    String fileName;
    byte[] content;
    Path filePath;

    public static EmailAttachment fromContent(String fileName, byte[] content) {
        return EmailAttachment.builder().fileName(fileName).content(content).build();
    }

    public static EmailAttachment fromFile(String fileName, Path filePath) {
        return EmailAttachment.builder().fileName(fileName).filePath(filePath).build();
    }
}
