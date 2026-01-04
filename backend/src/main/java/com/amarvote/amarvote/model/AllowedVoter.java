package com.amarvote.amarvote.model;

import java.io.Serializable;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "allowed_voters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(AllowedVoter.AllowedVoterId.class)
public class AllowedVoter {

    @Id
    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Id
    @Column(name = "user_email", nullable = false, columnDefinition = "TEXT")
    private String userEmail;

    @Column(name = "has_voted", nullable = false)
    @Builder.Default
    private Boolean hasVoted = false;

    // Composite key class
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class AllowedVoterId implements Serializable {
        private Long electionId;
        private String userEmail;
    }
}

