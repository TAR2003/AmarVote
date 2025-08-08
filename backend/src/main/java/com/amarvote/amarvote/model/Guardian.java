package com.amarvote.amarvote.model;

import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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
    private Long id; // Optional if using composite key instead

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "guardian_public_key", nullable = false, columnDefinition = "TEXT")
    private String guardianPublicKey;

    @Column(name = "sequence_order", nullable = false)
    private Integer sequenceOrder;

    @Column(name = "decrypted_or_not", nullable = false)
    private Boolean decryptedOrNot = false;

     @Column(name = "partial_decrypted_tally", columnDefinition = "TEXT")
    private String partialDecryptedTally;

    @Column(name = "proof", columnDefinition = "TEXT")
    private String proof;

    @Column(name = "guardian_decryption_key", columnDefinition = "TEXT")
    private String guardianDecryptionKey; // Added guardian_decryption_key field

    @Column(name = "tally_share", columnDefinition = "TEXT")
    private String tallyShare; // Added tally_share field

    @Column(name = "ballot_share", columnDefinition = "TEXT")
    private String ballotShare; // Added ballot_share field

    @Column(name = "key_backup", columnDefinition = "TEXT")
    private String keyBackup; // Added key_backup field (guardian_data)

    @Column(name = "credentials", columnDefinition = "TEXT")
    private String credentials;
}
