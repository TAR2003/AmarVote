package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.Optional;

import com.amarvote.amarvote.model.Election;

/**
 * Shared election activation checks for encrypt / cast / eligibility.
 */
public final class ElectionVoteReadiness {

    public record ActiveWindow(boolean active, String statusLabel) {}

    private ElectionVoteReadiness() {}

    public static Optional<String> activationBlockReason(Election election) {
        if (election.getJointPublicKey() == null || election.getBaseHash() == null) {
            return Optional.of("Election not activated");
        }
        if (election.getStartingTime() == null || election.getEndingTime() == null) {
            return Optional.of("Election not scheduled");
        }
        return Optional.empty();
    }

    public static ActiveWindow activeWindow(Election election) {
        Instant now = Instant.now();
        if (now.isBefore(election.getStartingTime())) {
            return new ActiveWindow(false, "Not Started");
        }
        if (now.isAfter(election.getEndingTime())) {
            return new ActiveWindow(false, "Ended");
        }
        return new ActiveWindow(true, "Active");
    }

    public static boolean isWithinVotingWindow(Election election) {
        return activeWindow(election).active();
    }
}
