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
    private final AuthorizedUserService authorizedUserService;

    /**
     * Atomically mark the voter as having voted and persist the ballot row.
     * Uses a conditional UPDATE so concurrent cast requests cannot double-vote.
     */
    @Transactional
    public CastPersistOutcome persistCast(Ballot ballot, String userEmail, Election election) {
        String email = authorizedUserService.normalizeEmail(userEmail);
        Long electionId = election.getElectionId();
        CastPersistOutcome voterOutcome = reserveVoterCastSlot(email, election);
        if (voterOutcome != CastPersistOutcome.SUCCESS) {
            return voterOutcome;
        }

        ballotRepository.save(ballot);
        return CastPersistOutcome.SUCCESS;
    }

    private CastPersistOutcome reserveVoterCastSlot(String email, Election election) {
        Long electionId = election.getElectionId();
        String eligibility = election.getEligibility();

        if ("unlisted".equals(eligibility)) {
            return reserveUnlistedVoterCastSlot(electionId, email);
        }
        if ("listed".equals(eligibility)) {
            return reserveListedVoterCastSlot(electionId, email);
        }
        return CastPersistOutcome.NOT_ELIGIBLE;
    }

    private CastPersistOutcome reserveListedVoterCastSlot(Long electionId, String email) {
        if (!allowedVoterRepository.existsByElectionIdAndUserEmail(electionId, email)) {
            return CastPersistOutcome.NOT_ELIGIBLE;
        }
        return markVoterAsVotedIfNotYet(electionId, email);
    }

    private CastPersistOutcome reserveUnlistedVoterCastSlot(Long electionId, String email) {
        if (allowedVoterRepository.existsByElectionIdAndUserEmailAndHasVotedTrue(electionId, email)) {
            return CastPersistOutcome.ALREADY_VOTED;
        }

        if (allowedVoterRepository.existsByElectionIdAndUserEmail(electionId, email)) {
            return markVoterAsVotedIfNotYet(electionId, email);
        }

        try {
            allowedVoterRepository.save(AllowedVoter.builder()
                    .electionId(electionId)
                    .userEmail(email)
                    .hasVoted(true)
                    .build());
            return CastPersistOutcome.SUCCESS;
        } catch (DataIntegrityViolationException ex) {
            return markVoterAsVotedIfNotYet(electionId, email);
        }
    }

    private CastPersistOutcome markVoterAsVotedIfNotYet(Long electionId, String email) {
        int updated = allowedVoterRepository.markAsVotedIfNotYet(electionId, email);
        return updated > 0 ? CastPersistOutcome.SUCCESS : CastPersistOutcome.ALREADY_VOTED;
    }
}
