package com.amarvote.amarvote.dto;

import java.time.Instant;
import java.util.List;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record ElectionCreationRequest(
    @NotBlank String electionTitle,
    String electionDescription,
    @NotEmpty List<String> candidateNames,
    @NotEmpty List<String> partyNames,
    List<String> candidatePictures,
    List<String> partyPictures,
    @NotBlank String guardianNumber,
    @NotBlank String quorumNumber,
    List<String> guardianEmails,
    @NotBlank String electionPrivacy,
    @NotBlank String electionEligibility,
    List<String> voterEmails,
    @Future Instant startingTime,
    @Future Instant endingTime
) {
    @AssertTrue(message = "Ending time must be after starting time")
    public boolean isEndingAfterStarting() {
        return endingTime.isAfter(startingTime);
    }
    
    @AssertTrue(message = "Quorum number cannot be higher than the number of guardians")
    public boolean isQuorumValid() {
        try {
            int guardianCount = Integer.parseInt(guardianNumber);
            int quorum = Integer.parseInt(quorumNumber);
            return quorum <= guardianCount && quorum > 0;
        } catch (NumberFormatException e) {
            return false;
        }
    }
}
