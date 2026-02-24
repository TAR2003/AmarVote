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

    /**
     * Like findElectionCenterIdsByElectionId but returns ONLY rows where the encrypted
     * tally was successfully stored (i.e. the tally-creation chunk completed successfully).
     * Rows created by failed tally chunks have a NULL encrypted_tally and must be excluded
     * from decryption/combine task dispatch and progress counting to prevent infinite
     * "Chunk has no encrypted tally" failures.
     */
    @Query("SELECT e.electionCenterId FROM ElectionCenter e WHERE e.electionId = :electionId AND e.encryptedTally IS NOT NULL AND e.encryptedTally != ''")
    List<Long> findElectionCenterIdsWithTallyByElectionId(@Param("electionId") Long electionId);

    // Count election centers with filled encrypted_tally field for an election
    @Query("SELECT COUNT(e) FROM ElectionCenter e WHERE e.electionId = :electionId AND e.encryptedTally IS NOT NULL AND e.encryptedTally != ''")
    long countByElectionIdAndEncryptedTallyNotNull(@Param("electionId") Long electionId);
    
    // Count election centers with filled electionResult field for an election
    @Query("SELECT COUNT(e) FROM ElectionCenter e WHERE e.electionId = :electionId AND e.electionResult IS NOT NULL AND e.electionResult != ''")
    long countByElectionIdAndElectionResultNotNull(@Param("electionId") Long electionId);
}
