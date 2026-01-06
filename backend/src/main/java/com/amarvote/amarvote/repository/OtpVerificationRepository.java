package com.amarvote.amarvote.repository;

import java.time.Instant;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.OtpVerification;

@Repository
public interface OtpVerificationRepository extends JpaRepository<OtpVerification, Long> {
    Optional<OtpVerification> findByUserEmailAndOtpCodeAndIsUsedFalseAndExpiresAtAfter(
        String userEmail, String otpCode, Instant expiresAt);
    
    void deleteByUserEmail(String userEmail);
}
