package com.amarvote.amarvote.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.Ballot;

@Repository
public interface BallotRepository extends JpaRepository<Ballot, Long> {

    // Find ballots by election ID
    List<Ballot> findByElectionId(Long electionId);

    // Find ballot by tracking code
    Optional<Ballot> findByTrackingCode(String trackingCode);

    // Find ballot by election ID and tracking code
    Optional<Ballot> findByElectionIdAndTrackingCode(Long electionId, String trackingCode);

    // Check if a ballot exists for a specific tracking code
    boolean existsByTrackingCode(String trackingCode);

    // Count ballots for a specific election
    @Query("SELECT COUNT(b) FROM Ballot b WHERE b.electionId = :electionId")
    long countByElectionId(@Param("electionId") Long electionId);

    // Find ballots by election ID and status
    List<Ballot> findByElectionIdAndStatus(Long electionId, String status);

    // Find only ballot IDs by election ID and status (memory-efficient)
    @Query("SELECT b.ballotId FROM Ballot b WHERE b.electionId = :electionId AND b.status = :status")
    List<Long> findBallotIdsByElectionIdAndStatus(@Param("electionId") Long electionId, @Param("status") String status);

    // Find ballots by list of IDs
    @Query("SELECT b FROM Ballot b WHERE b.ballotId IN :ballotIds")
    List<Ballot> findByBallotIdIn(@Param("ballotIds") List<Long> ballotIds);
}
