package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.SubmittedBallot;

@Repository
public interface SubmittedBallotRepository extends JpaRepository<SubmittedBallot, Long> {
    
    // Find submitted ballots by election center ID (chunk)
    List<SubmittedBallot> findByElectionCenterId(Long electionCenterId);
    
    // Count submitted ballots for a specific election center (chunk)
    long countByElectionCenterId(Long electionCenterId);
    
    // Delete all submitted ballots for a specific election center (chunk)
    void deleteByElectionCenterId(Long electionCenterId);
    
    // Check if a submitted ballot already exists for the given election center and cipher text
    boolean existsByElectionCenterIdAndCipherText(Long electionCenterId, String cipherText);
}
