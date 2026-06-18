package com.amarvote.amarvote.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.repository.AllowedVoterRepository;

import lombok.RequiredArgsConstructor;

/**
 * Indexed voter lookups for the vote path — one query per check where possible.
 */
@Service
@RequiredArgsConstructor
public class VoterEligibilityResolver {

    private final AllowedVoterRepository allowedVoterRepository;
    private final AuthorizedUserService authorizedUserService;

    /**
     * @param onAllowedRoll listed election: voter row exists; unlisted: always true
     * @param hasVoted      whether this email has already cast in the election
     */
    public record Snapshot(boolean onAllowedRoll, boolean hasVoted) {

        public boolean isEligibleToVote(Election election) {
            String mode = election.getEligibility();
            if ("unlisted".equals(mode)) {
                return true;
            }
            if ("listed".equals(mode)) {
                return onAllowedRoll;
            }
            return false;
        }
    }

    @Transactional(readOnly = true)
    public Snapshot resolve(String userEmail, Election election) {
        String email = authorizedUserService.normalizeEmail(userEmail);
        Long electionId = election.getElectionId();
        String mode = election.getEligibility();

        if ("unlisted".equals(mode)) {
            boolean hasVoted = allowedVoterRepository.existsByElectionIdAndUserEmailAndHasVotedTrue(
                    electionId, email);
            return new Snapshot(true, hasVoted);
        }

        if ("listed".equals(mode)) {
            return allowedVoterRepository.findByElectionIdAndUserEmail(electionId, email)
                    .map(row -> new Snapshot(true, Boolean.TRUE.equals(row.getHasVoted())))
                    .orElseGet(() -> new Snapshot(false, false));
        }

        return new Snapshot(false, false);
    }
}
