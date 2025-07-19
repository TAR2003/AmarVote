package com.amarvote.amarvote.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
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
@IdClass(CompensatedDecryptionId.class)
public class CompensatedDecryption {

    @Id
    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Id
    @Column(name = "compensating_guardian_sequence", nullable = false)
    private Integer compensatingGuardianSequence;

    @Id
    @Column(name = "missing_guardian_sequence", nullable = false)
    private Integer missingGuardianSequence;

    @Column(name = "compensated_tally_share", nullable = false, columnDefinition = "TEXT")
    private String compensatedTallyShare;

    @Column(name = "compensated_ballot_share", nullable = false, columnDefinition = "TEXT")
    private String compensatedBallotShare;
}
