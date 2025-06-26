package com.amarvote.amarvote.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "password_reset_tokens")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PasswordResetToken {

    @Id
    @GeneratedValue
    private UUID tokenId;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false, unique = true)
    private String token;

    @Column(nullable = false)
    private boolean used = false;

    @Column(nullable = false)
    private OffsetDateTime expiryTime;

    private OffsetDateTime createdAt = OffsetDateTime.now();

    private OffsetDateTime usedAt;
}
