package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.SubmittedBallot;

@Repository
public interface SubmittedBallotRepository extends JpaRepository<SubmittedBallot, Long> {
    
    // Find submitted ballots by election ID
    List<SubmittedBallot> findByElectionId(Long electionId);
    
    // Count submitted ballots for a specific election
    @Query("SELECT COUNT(sb) FROM SubmittedBallot sb WHERE sb.electionId = :electionId")
    long countByElectionId(@Param("electionId") Long electionId);
    
    // Delete all submitted ballots for a specific election
    void deleteByElectionId(Long electionId);
    
    // Check if a submitted ballot already exists for the given election and cipher text
    boolean existsByElectionIdAndCipherText(Long electionId, String cipherText);
}
