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
@Table(name = "election_choices")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionChoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "choice_id")
    private Long choiceId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Column(name = "option_title", nullable = false, columnDefinition = "TEXT")
    private String optionTitle;

    @Column(name = "option_description", columnDefinition = "TEXT")
    private String optionDescription;

    @Column(name = "party_name", columnDefinition = "TEXT")
    private String partyName;

    @Column(name = "candidate_pic", columnDefinition = "TEXT")
    private String candidatePic;

    @Column(name = "party_pic", columnDefinition = "TEXT")
    private String partyPic;

    @Column(name = "total_votes", nullable = false)
    private Integer totalVotes = 0;
}
