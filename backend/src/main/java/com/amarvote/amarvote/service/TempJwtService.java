package com.amarvote.amarvote.service;

import java.util.Date;
import java.util.Optional;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Service
public class TempJwtService {

    @Value("${jwt.temp-secret:QW1hclZvdGVUZW1wVG9rZW5TZWNyZXRGb3JNZmFTdGVwVXBfMjAyNl8wM18xNF9BbWFyVm90ZQ==}")
    private String tempSecretKey;

    private static final long TEMP_TOKEN_VALIDITY_MILLIS = 2 * 60 * 1000;
    private static final long EMAIL_VERIFICATION_TOKEN_VALIDITY_MILLIS = 10 * 60 * 1000;

    public String generateMfaPendingToken(String email) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date(now))
                .expiration(new Date(now + TEMP_TOKEN_VALIDITY_MILLIS))
                .claim("mfa_pending", true)
                .claim("scope", "mfa_verify")
                .signWith(getKey())
                .compact();
    }

    public Optional<String> extractEmailIfValidMfaToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Object mfaPendingClaim = claims.get("mfa_pending");
            boolean mfaPending = Boolean.TRUE.equals(mfaPendingClaim);
            if (!mfaPending) {
                return Optional.empty();
            }

            return Optional.ofNullable(claims.getSubject());
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    public String generateEmailVerificationToken(String email) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(email)
                .issuedAt(new Date(now))
                .expiration(new Date(now + EMAIL_VERIFICATION_TOKEN_VALIDITY_MILLIS))
                .claim("email_verified", true)
                .claim("scope", "register")
                .signWith(getKey())
                .compact();
    }

    public Optional<String> extractEmailIfValidVerifiedEmailToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(getKey())
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();

            Object claim = claims.get("email_verified");
            if (!Boolean.TRUE.equals(claim)) {
                return Optional.empty();
            }

            Object scope = claims.get("scope");
            if (!"register".equals(scope)) {
                return Optional.empty();
            }

            return Optional.ofNullable(claims.getSubject());
        } catch (JwtException | IllegalArgumentException ex) {
            return Optional.empty();
        }
    }

    private SecretKey getKey() {
        byte[] keyBytes = Decoders.BASE64.decode(tempSecretKey);
        return Keys.hmacShaKeyFor(keyBytes);
    }
}
