package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.TallyCreationStatus;

/**
 * @deprecated This repository is no longer used. Progress tracking is now handled by:
 * - RoundRobinTaskScheduler.getElectionProgress() for real-time state
 * - ElectionCenterRepository for database queries
 * Can be safely removed in future cleanup.
 */
@Deprecated
@Repository
public interface TallyCreationStatusRepository extends JpaRepository<TallyCreationStatus, Long> {
    
    Optional<TallyCreationStatus> findByElectionId(Long electionId);
    
    boolean existsByElectionId(Long electionId);
}
