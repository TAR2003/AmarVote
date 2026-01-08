package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.CombineStatus;

@Repository
public interface CombineStatusRepository extends JpaRepository<CombineStatus, Long> {
    
    Optional<CombineStatus> findByElectionId(Long electionId);
    
    boolean existsByElectionIdAndStatus(Long electionId, String status);
}
