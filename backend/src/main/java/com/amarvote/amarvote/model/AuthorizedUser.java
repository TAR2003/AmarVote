package com.amarvote.amarvote.model;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "authorized_users")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthorizedUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "authorized_user_id")
    private Long authorizedUserId;

    @Column(name = "email", nullable = false, unique = true, length = 255)
    private String email;

    @Builder.Default
    @Column(name = "is_allowed", nullable = false)
    private Boolean isAllowed = true;

    @Builder.Default
    @Column(name = "registered_or_not", nullable = false)
    private Boolean registeredOrNot = false;

    @Builder.Default
    @Column(name = "user_type", nullable = false, length = 20)
    private String userType = "user";

    @Builder.Default
    @Column(name = "can_create_elections", nullable = false)
    private Boolean canCreateElections = false;

    @Column(name = "last_login")
    private Instant lastLogin;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (isAllowed == null) {
            isAllowed = true;
        }
        if (registeredOrNot == null) {
            registeredOrNot = false;
        }
        if (userType == null || userType.isBlank()) {
            userType = "user";
        }
        if (canCreateElections == null) {
            canCreateElections = false;
        }
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}