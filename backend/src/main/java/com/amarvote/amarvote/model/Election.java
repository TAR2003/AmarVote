package com.amarvote.amarvote.model;

// Election.java

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

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
@Table(name = "elections")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Election {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "election_id")
    private Long electionId;

    @Column(name = "election_title", nullable = false)
    private String electionTitle;

    @Column(name = "election_description", columnDefinition = "TEXT")
    private String electionDescription;

    @Column(name = "number_of_guardians", nullable = false)
    private Integer numberOfGuardians;

    @Column(name = "election_quorum", nullable = false)
    private Integer electionQuorum;

    @Column(name = "no_of_candidates", nullable = false)
    private Integer noOfCandidates;

    @Column(name = "joint_public_key", columnDefinition = "TEXT")
    private String jointPublicKey;

    @Column(name = "manifest_hash", columnDefinition= "TEXT")
    private String manifestHash;

    @Column(name = "status", columnDefinition= "TEXT")
    private String status;

    @Column(name = "starting_time", nullable = false)
    private Instant startingTime;

    @Column(name = "ending_time", nullable = false)
    private Instant endingTime;

    @Column(name = "encrypted_tally", columnDefinition = "TEXT")
    private String encryptedTally;

    @Column(name = "base_hash", columnDefinition = "TEXT")
    private String baseHash;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private Instant createdAt;

    @Column(name = "profile_pic", columnDefinition = "TEXT")
    private String profilePic;

    @Column(name  = "admin_email", columnDefinition = "TEXT")
    private String adminEmail;

    @Column(name = "privacy", columnDefinition = "TEXT")
    private String privacy;

    @Column(name = "eligibility", columnDefinition = "TEXT")
    private String eligibility;
}



