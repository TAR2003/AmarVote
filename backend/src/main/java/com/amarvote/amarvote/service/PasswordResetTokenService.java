package com.amarvote.amarvote.service;

import com.amarvote.amarvote.model.PasswordResetToken;
import com.amarvote.amarvote.repository.PasswordResetTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.amarvote.amarvote.dto.TokenValidationResult;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.time.Duration;

@Service
public class PasswordResetTokenService {

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Transactional
    public PasswordResetToken createToken(String email, String token, long durationMillis) {
        tokenRepository.deleteByEmail(email); // allow only one active token per email
        PasswordResetToken tokenEntity = PasswordResetToken.builder()
                .email(email)
                .token(token)
                .expiryTime(OffsetDateTime.now().plus(Duration.ofMillis(durationMillis)))
                .build();
        return tokenRepository.save(tokenEntity);
    }

    public TokenValidationResult validateToken(String token) {
          Optional<PasswordResetToken> optional = tokenRepository.findByToken(token);
    
    if (optional.isEmpty()) {
        return new TokenValidationResult(false, "not_found", null);
    }

    PasswordResetToken t = optional.get();

    if (t.isUsed()) {
        return new TokenValidationResult(false, "used", t);
    }

    if (t.getExpiryTime().isBefore(OffsetDateTime.now())) {
        return new TokenValidationResult(false, "expired", t);
    }

    return new TokenValidationResult(true, "valid", t);
    }

    @Transactional
    public void markTokenAsUsed(PasswordResetToken token) {
        token.setUsed(true);
        token.setUsedAt(OffsetDateTime.now());
        tokenRepository.save(token);
    }

    @Transactional
    public void deleteExpiredTokens() {
        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository.deleteByExpiryTimeBefore(now);
    }

}
