package com.amarvote.amarvote.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.AllowedVoter.AllowedVoterId;

@Repository
public interface AllowedVoterRepository extends JpaRepository<AllowedVoter, AllowedVoterId> {
    
    // Check if a user is allowed to vote in a specific election
    Optional<AllowedVoter> findByElectionIdAndUserEmail(Long electionId, String userEmail);
    
    // Get all allowed voters for a specific election
    List<AllowedVoter> findByElectionId(Long electionId);
    
    // Get all elections where a user is allowed to vote
    List<AllowedVoter> findByUserEmail(String userEmail);
    
    // Check if user exists in allowed voters by email and election ID
    boolean existsByElectionIdAndUserEmail(Long electionId, String userEmail);
    
    // Count allowed voters for an election
    long countByElectionId(Long electionId);
    
    // Find voters who have already voted
    List<AllowedVoter> findByElectionIdAndHasVoted(Long electionId, Boolean hasVoted);
}

