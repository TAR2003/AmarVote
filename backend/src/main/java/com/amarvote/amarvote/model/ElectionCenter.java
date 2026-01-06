package com.amarvote.amarvote.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "election_center")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionCenter {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "election_center_id")
    private Long electionCenterId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "encrypted_tally", columnDefinition = "TEXT")
    private String encryptedTally;

    @Column(name = "election_result", columnDefinition = "TEXT")
    private String electionResult;
}
