package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.CompensatedDecryption;

@Repository
public interface CompensatedDecryptionRepository extends JpaRepository<CompensatedDecryption, Long> {
    
    // Find compensated decryptions by election center ID (chunk)
    List<CompensatedDecryption> findByElectionCenterId(Long electionCenterId);
    
    // Find compensated decryptions for a missing guardian in a chunk
    List<CompensatedDecryption> findByElectionCenterIdAndMissingGuardianId(
        Long electionCenterId, 
        Long missingGuardianId
    );
    
    // Find compensated decryptions by compensating guardian in a chunk
    List<CompensatedDecryption> findByElectionCenterIdAndCompensatingGuardianId(
        Long electionCenterId, 
        Long compensatingGuardianId
    );
    
    // Check if compensated decryption exists
    boolean existsByElectionCenterIdAndCompensatingGuardianIdAndMissingGuardianId(
        Long electionCenterId, 
        Long compensatingGuardianId, 
        Long missingGuardianId
    );
    
    // Count compensated decryptions by compensating guardian for an election (across all chunks)
    @Query("SELECT COUNT(cd) FROM CompensatedDecryption cd " +
           "JOIN ElectionCenter ec ON cd.electionCenterId = ec.electionCenterId " +
           "WHERE ec.electionId = :electionId AND cd.compensatingGuardianId = :compensatingGuardianId")
    long countByElectionIdAndCompensatingGuardianId(
        @Param("electionId") Long electionId, 
        @Param("compensatingGuardianId") Long compensatingGuardianId
    );
}
