package com.amarvote.amarvote.model;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Minimal vote receipt record — no voter email or identity stored.
 */
@Entity
@Table(name = "vote_receipts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VoteReceipt {

    @Id
    @Column(name = "receipt_id", nullable = false)
    private UUID receiptId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "election_title", nullable = false, columnDefinition = "TEXT")
    private String electionTitle;

    @Column(name = "vote_hash", nullable = false, columnDefinition = "TEXT")
    private String voteHash;

    @Column(name = "tracking_code", nullable = false, columnDefinition = "TEXT")
    private String trackingCode;

    @Column(name = "candidate_name", columnDefinition = "TEXT")
    private String candidateName;

    @Column(name = "party_name", columnDefinition = "TEXT")
    private String partyName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
