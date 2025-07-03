package com.amarvote.amarvote.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ballots")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ballot {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "ballot_id")
    private Long ballotId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "submission_time", updatable = false)
    @CreationTimestamp
    private Instant submissionTime;

    @Column(name = "status", nullable = false, columnDefinition = "TEXT")
    private String status;

    @Column(name = "cipher_text", nullable = false, columnDefinition = "TEXT")
    private String cipherText;

    @Column(name = "hash_code", nullable = false, columnDefinition = "TEXT")
    private String hashCode;

    @Column(name = "tracking_code", nullable = false, columnDefinition = "TEXT")
    private String trackingCode;

    @Column(name = "master_nonce", columnDefinition = "TEXT")
    private String masterNonce;

    @Column(name = "proof", columnDefinition = "TEXT")
    private String proof;

    @Column(name = "ballot_style", columnDefinition = "TEXT")
    private String ballotStyle;

    @Column(name = "ballot_nonces", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private String ballotNonces;

    @Column(name = "contest_hashes", columnDefinition = "JSONB")
    @JdbcTypeCode(SqlTypes.JSON)
    private String contestHashes;
}
