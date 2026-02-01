package com.amarvote.amarvote.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.DecryptionStatus;

/**
 * @deprecated This repository is no longer used. Progress tracking is now handled by:
 * - RoundRobinTaskScheduler.getElectionProgress() for real-time state
 * - DecryptionRepository and CompensatedDecryptionRepository for database queries
 * Can be safely removed in future cleanup.
 */
@Deprecated
@Repository
public interface DecryptionStatusRepository extends JpaRepository<DecryptionStatus, Long> {
    
    Optional<DecryptionStatus> findByElectionIdAndGuardianId(Long electionId, Long guardianId);
    
    List<DecryptionStatus> findByElectionId(Long electionId);
    
    List<DecryptionStatus> findByElectionIdAndStatus(Long electionId, String status);
    
    boolean existsByElectionIdAndGuardianId(Long electionId, Long guardianId);
}
