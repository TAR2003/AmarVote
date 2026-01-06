package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
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
}
