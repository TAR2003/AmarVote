package com.amarvote.amarvote.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "guardians")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Guardian {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "guardian_id")
    private Long guardianId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "user_email", nullable = false, columnDefinition = "TEXT")
    private String userEmail;

    @Column(name = "key_backup", columnDefinition = "TEXT")
    private String keyBackup;

    @Column(name = "guardian_public_key", nullable = false, columnDefinition = "TEXT")
    private String guardianPublicKey;

    @Column(name = "sequence_order", nullable = false)
    private Integer sequenceOrder;

    @Column(name = "decrypted_or_not", nullable = false)
    @Builder.Default
    private Boolean decryptedOrNot = false;

    @Column(name = "credentials", columnDefinition = "TEXT")
    private String credentials;
}
