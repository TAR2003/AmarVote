package com.amarvote.amarvote.dto;

import lombok.Builder;

@Builder
public record KeyCeremonyStatusResponse(
    Long electionId,
    String electionTitle,
    Integer totalGuardians,
    Integer submittedGuardians,
    Integer submittedBackupGuardians,
    Integer quorum,
    boolean allSubmitted,
    boolean allBackupsSubmitted,
    boolean backupRoundOpen,
    String currentRound,
    boolean readyForActivation
) {}
