package com.amarvote.amarvote.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "decryptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Decryption {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "decryption_id")
    private Long decryptionId;

    @Column(name = "election_center_id", nullable = false)
    private Long electionCenterId;

    @Column(name = "guardian_id", nullable = false)
    private Long guardianId;

    @Column(name = "partial_decrypted_tally", columnDefinition = "TEXT")
    private String partialDecryptedTally;

    @Column(name = "guardian_decryption_key", columnDefinition = "TEXT")
    private String guardianDecryptionKey;

    @Column(name = "tally_share", columnDefinition = "TEXT")
    private String tallyShare;

    @Column(name = "key_backup", columnDefinition = "TEXT")
    private String keyBackup;

    @Column(name = "date_performed", updatable = false)
    @CreationTimestamp
    private Instant datePerformed;
}
