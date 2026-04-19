package com.amarvote.amarvote.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import com.amarvote.amarvote.util.MfaSecretConverter;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Convert(converter = MfaSecretConverter.class)
    @Column(name = "mfa_secret", length = 255)
    private String mfaSecret;

    @Builder.Default
    @Column(name = "is_mfa_enabled", nullable = false)
    private Boolean isMfaEnabled = false;

    @Builder.Default
    @Column(name = "mfa_registered", nullable = false)
    private Boolean mfaRegistered = false;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (isMfaEnabled == null) {
            isMfaEnabled = false;
        }
        if (mfaRegistered == null) {
            mfaRegistered = false;
        }
    }
}
