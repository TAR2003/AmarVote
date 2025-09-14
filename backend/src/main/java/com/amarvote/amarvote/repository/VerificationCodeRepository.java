package com.amarvote.amarvote.repository;

import java.time.OffsetDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amarvote.amarvote.model.VerificationCode;

public interface VerificationCodeRepository extends JpaRepository<VerificationCode, Long> {
    Optional<VerificationCode> findByCode(String code);
    Optional<VerificationCode> findByEmail(String email);
    
    void deleteByExpiryDateBefore(OffsetDateTime time);
    
    @Modifying
    @Query("DELETE FROM VerificationCode vc WHERE vc.code = :code")
    void deleteByCode(@Param("code") String code);

    @Modifying
    @Query("DELETE FROM VerificationCode vc WHERE vc.email = :email")
    void deleteByEmail(@Param("email") String email);
}