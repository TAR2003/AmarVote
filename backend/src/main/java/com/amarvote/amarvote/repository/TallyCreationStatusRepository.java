package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.TallyCreationStatus;

@Repository
public interface TallyCreationStatusRepository extends JpaRepository<TallyCreationStatus, Long> {
    
    Optional<TallyCreationStatus> findByElectionId(Long electionId);
    
    boolean existsByElectionId(Long electionId);
}
