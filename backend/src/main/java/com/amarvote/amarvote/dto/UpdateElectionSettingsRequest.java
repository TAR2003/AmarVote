package com.amarvote.amarvote.dto;

public record UpdateElectionSettingsRequest(
    String privacy,
    Boolean sendBallotReceipt,
    String electionDescription
) {}
