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
    List<Guardian> findByElectionIdAndUserEmail(Long electionId, String userEmail);
    
    // Find guardian by user email and election ID (returns single result)
    java.util.Optional<Guardian> findByUserEmailAndElectionId(String userEmail, Long electionId);
    
    // Find all guardians for a specific election
    List<Guardian> findByElectionId(Long electionId);
    
    // Find all elections where a user is guardian
    List<Guardian> findByUserEmail(String userEmail);
    
    // Find guardian by election ID and sequence order
    Guardian findByElectionIdAndSequenceOrder(Long electionId, Integer sequenceOrder);
    
    // Find guardians ordered by sequence for a specific election
    List<Guardian> findByElectionIdOrderBySequenceOrder(Long electionId);
    
    // Count guardians who have completed partial decryption for an election
    @Query("SELECT COUNT(g) FROM Guardian g WHERE g.electionId = :electionId AND g.decryptedOrNot = true")
    int countDecryptedGuardiansByElectionId(@Param("electionId") Long electionId);
    
    // Find all guardians who have completed partial decryption for an election
    @Query("SELECT g FROM Guardian g WHERE g.electionId = :electionId AND g.decryptedOrNot = :decryptedOrNot ORDER BY g.sequenceOrder")
    List<Guardian> findByElectionIdAndDecryptedOrNot(@Param("electionId") Long electionId, @Param("decryptedOrNot") Boolean decryptedOrNot);
}
