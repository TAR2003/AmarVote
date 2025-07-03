package com.amarvote.amarvote.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.AllowedVoter;

@Repository
public interface AllowedVoterRepository extends JpaRepository<AllowedVoter, Long> {
    
    // Check if a user is allowed to vote in a specific election
    @Query("SELECT av FROM AllowedVoter av " +
           "JOIN User u ON av.userId = u.userId " +
           "WHERE av.electionId = :electionId AND u.userEmail = :userEmail")
    List<AllowedVoter> findByElectionIdAndUserEmail(@Param("electionId") Long electionId, @Param("userEmail") String userEmail);
    
    // Get all allowed voters for a specific election
    List<AllowedVoter> findByElectionId(Long electionId);
    
    // Get all elections where a user is allowed to vote
    @Query("SELECT av FROM AllowedVoter av " +
           "JOIN User u ON av.userId = u.userId " +
           "WHERE u.userEmail = :userEmail")
    List<AllowedVoter> findByUserEmail(@Param("userEmail") String userEmail);
    
    // Find allowed voters with user details for a specific election
    @Query("SELECT av, u FROM AllowedVoter av " +
           "JOIN User u ON av.userId = u.userId " +
           "WHERE av.electionId = :electionId " +
           "ORDER BY u.userName")
    List<Object[]> findAllowedVotersWithUserDetailsByElectionId(@Param("electionId") Long electionId);
    
    // Check if user exists in allowed voters by user ID and election ID
    @Query("SELECT av FROM AllowedVoter av WHERE av.electionId = :electionId AND av.userId = :userId")
    Optional<AllowedVoter> findByElectionIdAndUserId(@Param("electionId") Long electionId, @Param("userId") Integer userId);
    
    // Check if user exists in allowed voters by user ID and election ID
    boolean existsByElectionIdAndUserId(Long electionId, Integer userId);
}

