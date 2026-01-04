package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.ElectionCenter;

@Repository
public interface ElectionCenterRepository extends JpaRepository<ElectionCenter, Long> {
    List<ElectionCenter> findByElectionId(Long electionId);
}
