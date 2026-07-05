package com.amarvote.amarvote.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

import javax.crypto.SecretKey;

@Service
public class ReceiptTokenService {

    private static final String PURPOSE = "vote-receipt";

    @Value("${jwt.receipt.secret:${jwt.temp-secret}}")
    private String secretKey;

    @Value("${amarvote.receipt.token-validity-days:30}")
    private long validityDays;

    public String hashEmail(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        String normalized = email.trim().toLowerCase(Locale.ROOT);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalized.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public String generateToken(UUID receiptId, String emailHash) {
        long validityMillis = validityDays * 24L * 60L * 60L * 1000L;
        return Jwts.builder()
                .claim("receiptId", receiptId.toString())
                .claim("emailHash", emailHash)
                .claim("purpose", PURPOSE)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + validityMillis))
                .signWith(getKey())
                .compact();
    }

    public Claims parseAndValidate(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(getKey())
                .build()
                .parseSignedClaims(token)
                .getPayload();

        if (!PURPOSE.equals(claims.get("purpose", String.class))) {
            throw new JwtException("Invalid receipt token purpose");
        }

        String receiptId = claims.get("receiptId", String.class);
        if (receiptId == null || receiptId.isBlank()) {
            throw new JwtException("Receipt token missing receiptId");
        }

        return claims;
    }

    private SecretKey getKey() {
        byte[] keyBytes = Decoders.BASE64.decode(secretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
