package com.amarvote.amarvote.model;

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
@Table(name = "compensated_decryptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompensatedDecryption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "compensated_decryption_id")
    private Long compensatedDecryptionId;

    @Column(name = "election_center_id", nullable = false)
    private Long electionCenterId;

    @Column(name = "compensating_guardian_id", nullable = false)
    private Long compensatingGuardianId;

    @Column(name = "missing_guardian_id", nullable = false)
    private Long missingGuardianId;

    @Column(name = "compensated_tally_share", nullable = false, columnDefinition = "TEXT")
    private String compensatedTallyShare;

    @Column(name = "compensated_ballot_share", nullable = false, columnDefinition = "TEXT")
    private String compensatedBallotShare;
}
