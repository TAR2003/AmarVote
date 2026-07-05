package com.amarvote.amarvote.controller;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.amarvote.amarvote.model.VoteReceipt;
import com.amarvote.amarvote.service.ReceiptTokenService;
import com.amarvote.amarvote.service.VoteReceiptService;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

@RestController
@RequestMapping("/api/receipt")
@RequiredArgsConstructor
public class ReceiptDownloadController {

    private final ReceiptTokenService receiptTokenService;
    private final VoteReceiptService voteReceiptService;

    @GetMapping("/download")
    public ResponseEntity<?> downloadReceipt(
            @RequestParam String token,
            @RequestHeader(value = "Accept", defaultValue = "") String accept) {
        if (accept.contains("text/html")) {
            String encodedToken = URLEncoder.encode(token, StandardCharsets.UTF_8);
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create("/receipt/download?token=" + encodedToken))
                    .build();
        }

        try {
            Claims claims = receiptTokenService.parseAndValidate(token);
            UUID receiptId = UUID.fromString(claims.get("receiptId", String.class));

            VoteReceipt receipt = voteReceiptService.findByReceiptId(receiptId)
                    .orElseThrow(() -> new ResponseStatusException(NOT_FOUND, "Receipt not found"));

            String body = voteReceiptService.formatPlainText(receipt);
            String filename = "vote_receipt_" + sanitizeFilename(receipt.getTrackingCode()) + ".txt";
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);

            ContentDisposition disposition = ContentDisposition.attachment()
                    .filename(filename, StandardCharsets.UTF_8)
                    .build();

            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .contentLength(bytes.length)
                    .body(bytes);
        } catch (IllegalArgumentException | JwtException ex) {
            throw new ResponseStatusException(FORBIDDEN, "Invalid or expired receipt link");
        }
    }

    private static String sanitizeFilename(String input) {
        if (input == null || input.isBlank()) {
            return "receipt";
        }
        String sanitized = input.replaceAll("[^a-zA-Z0-9._-]", "_");
        return sanitized.length() > 60 ? sanitized.substring(0, 60) : sanitized;
    }
}
