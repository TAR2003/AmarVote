package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.Decryption;

@Repository
public interface DecryptionRepository extends JpaRepository<Decryption, Long> {
    List<Decryption> findByElectionCenterId(Long electionCenterId);
    List<Decryption> findByGuardianId(Long guardianId);
    List<Decryption> findByElectionCenterIdAndGuardianId(Long electionCenterId, Long guardianId);
    
    // Count decryptions for a guardian in an election (across all chunks)
    @Query("SELECT COUNT(d) FROM Decryption d " +
           "JOIN ElectionCenter ec ON d.electionCenterId = ec.electionCenterId " +
           "WHERE ec.electionId = :electionId AND d.guardianId = :guardianId")
    long countByElectionIdAndGuardianId(@Param("electionId") Long electionId, @Param("guardianId") Long guardianId);
}
