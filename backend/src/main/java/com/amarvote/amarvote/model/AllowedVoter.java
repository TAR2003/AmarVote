package com.amarvote.amarvote.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "allowed_voters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AllowedVoter {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id; // Optional: only needed if not using composite key

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "user_id", nullable = false)
    private Integer userId;

    @Column(name = "has_voted", nullable = false)
    private Boolean hasVoted = false;
}

