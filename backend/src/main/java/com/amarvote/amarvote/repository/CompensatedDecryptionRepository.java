package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.CompensatedDecryption;
import com.amarvote.amarvote.model.CompensatedDecryptionId;

@Repository
public interface CompensatedDecryptionRepository extends JpaRepository<CompensatedDecryption, CompensatedDecryptionId> {
    
    List<CompensatedDecryption> findByElectionId(Long electionId);
    
    @Query("SELECT cd FROM CompensatedDecryption cd WHERE cd.electionId = :electionId AND cd.missingGuardianSequence = :missingGuardianSequence")
    List<CompensatedDecryption> findByElectionIdAndMissingGuardianSequence(
        @Param("electionId") Long electionId, 
        @Param("missingGuardianSequence") Integer missingGuardianSequence
    );
    
    @Query("SELECT cd FROM CompensatedDecryption cd WHERE cd.electionId = :electionId AND cd.compensatingGuardianSequence = :compensatingGuardianSequence")
    List<CompensatedDecryption> findByElectionIdAndCompensatingGuardianSequence(
        @Param("electionId") Long electionId, 
        @Param("compensatingGuardianSequence") Integer compensatingGuardianSequence
    );
    
    @Query("SELECT cd FROM CompensatedDecryption cd WHERE cd.electionId = :electionId AND cd.compensatingGuardianSequence = :compensatingGuardianSequence AND cd.missingGuardianSequence = :missingGuardianSequence")
    List<CompensatedDecryption> findByElectionIdAndCompensatingGuardianSequenceAndMissingGuardianSequence(
        @Param("electionId") Long electionId, 
        @Param("compensatingGuardianSequence") Integer compensatingGuardianSequence,
        @Param("missingGuardianSequence") Integer missingGuardianSequence
    );
    
    boolean existsByElectionIdAndCompensatingGuardianSequenceAndMissingGuardianSequence(
        Long electionId, 
        Integer compensatingGuardianSequence, 
        Integer missingGuardianSequence
    );
}
