package com.amarvote.amarvote.model;

import java.time.OffsetDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

@Entity
@Table(name = "signup_verification", indexes = {
    @Index(name = "idx_verification_code_email", columnList = "email")
})
public class VerificationCode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "verification_code", nullable = false, unique = true, length = 255)
    private String code;

    @Column(nullable = false, length = 255)
    private String email;

    @Column(name = "expiry_date", nullable = false)
    private OffsetDateTime expiryDate;

    public VerificationCode() {
    }

    public VerificationCode(String code, String email, OffsetDateTime expiryDate) {
        this.code = code;
        this.email = email;
        this.expiryDate = expiryDate;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public OffsetDateTime getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(OffsetDateTime expiryDate) {
        this.expiryDate = expiryDate;
    }
}
