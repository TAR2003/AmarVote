package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.ElectionChoice;

@Repository
public interface ElectionChoiceRepository extends JpaRepository<ElectionChoice, Long> {
    
    // Get all election choices for a specific election
    List<ElectionChoice> findByElectionIdOrderByChoiceIdAsc(Long electionId);
}

