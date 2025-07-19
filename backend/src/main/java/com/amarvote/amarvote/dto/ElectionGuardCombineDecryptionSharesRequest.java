package com.amarvote.amarvote.dto;

import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

import lombok.Builder;

@Builder
public record ElectionGuardCombineDecryptionSharesRequest(
        @JsonProperty("party_names") List<String> party_names,
        @JsonProperty("candidate_names") List<String> candidate_names,
        @JsonProperty("joint_public_key")  String joint_public_key,
        @JsonProperty("commitment_hash")  String commitment_hash,
        @JsonProperty("ciphertext_tally")  String ciphertext_tally,
        @JsonProperty("submitted_ballots") List<String> submitted_ballots,
        @JsonProperty("guardian_data") List<String> guardian_data,
        @JsonProperty("available_guardian_ids") List<String> available_guardian_ids,
        @JsonProperty("available_guardian_public_keys") List<String> available_guardian_public_keys,
        @JsonProperty("available_tally_shares") List<String> available_tally_shares,
        @JsonProperty("available_ballot_shares") List<String> available_ballot_shares,
        @JsonProperty("missing_guardian_ids") List<String> missing_guardian_ids,
        @JsonProperty("compensating_guardian_ids") List<String> compensating_guardian_ids,
        @JsonProperty("compensated_tally_shares") List<String> compensated_tally_shares,
        @JsonProperty("compensated_ballot_shares") List<String> compensated_ballot_shares,
        @JsonProperty("quorum") Integer quorum,
        @JsonProperty("number_of_guardians") Integer number_of_guardians
) {
}
