package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.CombineStatus;

/**
 * @deprecated This repository is no longer used. Progress tracking is now handled by:
 * - RoundRobinTaskScheduler.getElectionProgress() for real-time state
 * - ElectionCenterRepository for database queries (electionResult field)
 * Can be safely removed in future cleanup.
 */
@Deprecated
@Repository
public interface CombineStatusRepository extends JpaRepository<CombineStatus, Long> {
    
    Optional<CombineStatus> findByElectionId(Long electionId);
    
    boolean existsByElectionIdAndStatus(Long electionId, String status);
}
