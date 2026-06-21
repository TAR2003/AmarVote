package com.amarvote.amarvote.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "ballots", indexes = {
    @Index(name = "idx_ballots_election_status", columnList = "election_id, status"),
    @Index(name = "idx_ballots_election_tracking", columnList = "election_id, tracking_code")
})
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
}
