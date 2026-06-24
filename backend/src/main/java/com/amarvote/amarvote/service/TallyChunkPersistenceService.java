package com.amarvote.amarvote.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.SubmittedBallot;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;

import lombok.RequiredArgsConstructor;

/**
 * Persists tally chunk results atomically after ElectionGuard returns.
 * Verifies election_center still exists (avoids fk_election_center when tally is stopped mid-flight).
 */
@Service
@RequiredArgsConstructor
public class TallyChunkPersistenceService {

    private final ElectionCenterRepository electionCenterRepository;
    private final SubmittedBallotRepository submittedBallotRepository;

    @Transactional
    public void persistTallyResults(Long electionCenterId, String encryptedTallyJson, List<SubmittedBallot> submittedBallots) {
        ElectionCenter center = electionCenterRepository.findById(electionCenterId)
            .orElseThrow(() -> new IllegalStateException(
                "Election center " + electionCenterId + " no longer exists; tally may have been stopped or deleted"));

        center.setEncryptedTally(encryptedTallyJson);
        electionCenterRepository.saveAndFlush(center);

        if (submittedBallots != null && !submittedBallots.isEmpty()) {
            submittedBallotRepository.saveAll(submittedBallots);
        }
    }
}
