package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.ElectionCenter;

@Repository
public interface ElectionCenterRepository extends JpaRepository<ElectionCenter, Long> {
    List<ElectionCenter> findByElectionId(Long electionId);

    // Find only election center IDs by election ID (memory-efficient)
    @Query("SELECT e.electionCenterId FROM ElectionCenter e WHERE e.electionId = :electionId")
    List<Long> findElectionCenterIdsByElectionId(@Param("electionId") Long electionId);
}
