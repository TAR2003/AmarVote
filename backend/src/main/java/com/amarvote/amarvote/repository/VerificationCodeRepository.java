package com.amarvote.amarvote.repository;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.VerificationCode;

public interface VerificationCodeRepository extends JpaRepository<VerificationCode, Long> {
    Optional<VerificationCode> findByCode(String code);
    Optional<VerificationCode> findByEmail(String email);
    void deleteByExpiryDateBefore(OffsetDateTime time);
    void deleteByCode(String code);
}