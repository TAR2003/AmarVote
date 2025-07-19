package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ElectionGuardTallyRequest {
    private List<String> party_names;
    private List<String> candidate_names;
    private String joint_public_key;
    private String commitment_hash;
    private List<String> encrypted_ballots;
    private int number_of_guardians;
    private int quorum;
}
