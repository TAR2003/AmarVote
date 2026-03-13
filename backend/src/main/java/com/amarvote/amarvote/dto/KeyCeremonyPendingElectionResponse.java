package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record KeyCeremonyPendingElectionResponse(
    Long electionId,
    String electionTitle,
    String electionDescription,
    Integer electionQuorum,
    Integer numberOfGuardians,
    Integer submittedGuardians,
    Integer submittedBackupGuardians,
    boolean allKeyPairsSubmitted,
    boolean backupRoundOpen,
    boolean guardianBackupSubmitted,
    String currentRound,
    boolean readyForActivation
) {}
