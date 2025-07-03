package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.Guardian;

@Repository
public interface GuardianRepository extends JpaRepository<Guardian, Long> {
    
    // Find guardians by election ID and user email
    @Query("SELECT g FROM Guardian g " +
           "JOIN User u ON g.userId = u.userId " +
           "WHERE g.electionId = :electionId AND u.userEmail = :userEmail")
    List<Guardian> findByElectionIdAndUserEmail(@Param("electionId") Long electionId, @Param("userEmail") String userEmail);
    
    // Find all guardians for a specific election
    @Query("SELECT g FROM Guardian g WHERE g.electionId = :electionId")
    List<Guardian> findByElectionId(@Param("electionId") Long electionId);
    
    // Find all elections where a user is guardian
    @Query("SELECT g FROM Guardian g " +
           "JOIN User u ON g.userId = u.userId " +
           "WHERE u.userEmail = :userEmail")
    List<Guardian> findByUserEmail(@Param("userEmail") String userEmail);
}
