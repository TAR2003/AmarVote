package com.amarvote.amarvote.dto;

import java.time.Instant;

public record UpdateElectionSettingsRequest(
    String privacy,
    Boolean sendBallotReceipt,
    String electionDescription,
    Integer maxChoices,
    Integer winnerNo,
    Instant startingTime,
    Instant endingTime
) {}
