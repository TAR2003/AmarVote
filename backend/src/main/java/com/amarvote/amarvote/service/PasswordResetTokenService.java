package com.amarvote.amarvote.service;

import com.amarvote.amarvote.model.PasswordResetToken;
import com.amarvote.amarvote.repository.PasswordResetTokenRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.time.Duration;

@Service
public class PasswordResetTokenService {

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    public PasswordResetToken createToken(String email, String token, long durationMillis) {
        tokenRepository.deleteByEmail(email); // allow only one active token per email
        PasswordResetToken tokenEntity = PasswordResetToken.builder()
                .email(email)
                .token(token)
                .expiryTime(OffsetDateTime.now().plus(Duration.ofMillis(durationMillis)))
                .build();
        return tokenRepository.save(tokenEntity);
    }

    public Optional<PasswordResetToken> validateToken(String token) {
        return tokenRepository.findByToken(token)
                .filter(t -> !t.isUsed() && t.getExpiryTime().isAfter(OffsetDateTime.now()));
    }

    public void markTokenAsUsed(PasswordResetToken token) {
        token.setUsed(true);
        token.setUsedAt(OffsetDateTime.now());
        tokenRepository.save(token);
    }

    @Transactional
    public void deleteExpiredTokens() {
        OffsetDateTime now = OffsetDateTime.now();
        tokenRepository.deleteByExpiryDateBefore(now);
    }

}
