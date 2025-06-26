package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {
    Optional<PasswordResetToken> findByToken(String token);
    void deleteByEmail(String email);
    void deleteByExpiryDateBefore(OffsetDateTime time);
}
