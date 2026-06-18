package com.amarvote.amarvote.service;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Ballot;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.BallotRepository;

import lombok.RequiredArgsConstructor;

/**
 * Short, atomic DB work for casting a ballot.
 * Keeps transactions free of external HTTP (ElectionGuard, blockchain).
 */
@Service
@RequiredArgsConstructor
public class BallotCastPersistenceService {

    public enum CastPersistOutcome {
        SUCCESS,
        ALREADY_VOTED,
        NOT_ELIGIBLE
    }

    private final BallotRepository ballotRepository;
    private final AllowedVoterRepository allowedVoterRepository;

    /**
     * Atomically mark the voter as having voted and persist the ballot row.
     * Uses a conditional UPDATE so concurrent cast requests cannot double-vote.
     */
    @Transactional
    public CastPersistOutcome persistCast(Ballot ballot, String userEmail, Election election) {
        Long electionId = election.getElectionId();
        CastPersistOutcome voterOutcome = reserveVoterCastSlot(userEmail, election);
        if (voterOutcome != CastPersistOutcome.SUCCESS) {
            return voterOutcome;
        }

        ballotRepository.save(ballot);
        return CastPersistOutcome.SUCCESS;
    }

    private CastPersistOutcome reserveVoterCastSlot(String userEmail, Election election) {
        Long electionId = election.getElectionId();
        String eligibility = election.getEligibility();

        if ("unlisted".equals(eligibility)) {
            return reserveUnlistedVoterCastSlot(electionId, userEmail);
        }
        if ("listed".equals(eligibility)) {
            return reserveListedVoterCastSlot(electionId, userEmail);
        }
        return CastPersistOutcome.NOT_ELIGIBLE;
    }

    private CastPersistOutcome reserveListedVoterCastSlot(Long electionId, String userEmail) {
        if (!allowedVoterRepository.existsByElectionIdAndUserEmail(electionId, userEmail)) {
            return CastPersistOutcome.NOT_ELIGIBLE;
        }
        return markVoterAsVotedIfNotYet(electionId, userEmail);
    }

    private CastPersistOutcome reserveUnlistedVoterCastSlot(Long electionId, String userEmail) {
        if (allowedVoterRepository.existsByElectionIdAndUserEmailAndHasVotedTrue(electionId, userEmail)) {
            return CastPersistOutcome.ALREADY_VOTED;
        }

        if (allowedVoterRepository.existsByElectionIdAndUserEmail(electionId, userEmail)) {
            return markVoterAsVotedIfNotYet(electionId, userEmail);
        }

        try {
            allowedVoterRepository.save(AllowedVoter.builder()
                    .electionId(electionId)
                    .userEmail(userEmail)
                    .hasVoted(true)
                    .build());
            return CastPersistOutcome.SUCCESS;
        } catch (DataIntegrityViolationException ex) {
            return markVoterAsVotedIfNotYet(electionId, userEmail);
        }
    }

    private CastPersistOutcome markVoterAsVotedIfNotYet(Long electionId, String userEmail) {
        int updated = allowedVoterRepository.markAsVotedIfNotYet(electionId, userEmail);
        return updated > 0 ? CastPersistOutcome.SUCCESS : CastPersistOutcome.ALREADY_VOTED;
    }
}
