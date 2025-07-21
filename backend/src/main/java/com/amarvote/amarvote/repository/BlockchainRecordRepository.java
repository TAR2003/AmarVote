package com.amarvote.amarvote.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.BlockchainRecord;

@Repository
public interface BlockchainRecordRepository extends JpaRepository<BlockchainRecord, Long> {
    
    Optional<BlockchainRecord> findByTrackingCode(String trackingCode);
    
    List<BlockchainRecord> findByElectionId(Long electionId);
    
    List<BlockchainRecord> findByVerificationStatus(String verificationStatus);
    
    @Query("SELECT br FROM BlockchainRecord br WHERE br.electionId = :electionId AND br.verificationStatus = :status")
    List<BlockchainRecord> findByElectionIdAndStatus(@Param("electionId") Long electionId, @Param("status") String status);
    
    /**
     * Find all blockchain records for a specific election with given verification status
     */
    List<BlockchainRecord> findByElectionIdAndVerificationStatus(Long electionId, String verificationStatus);
    
    @Query("SELECT br FROM BlockchainRecord br WHERE br.verificationStatus = 'PENDING' AND br.retryCount < 3")
    List<BlockchainRecord> findPendingRecordsForRetry();
    
    @Query("SELECT COUNT(br) FROM BlockchainRecord br WHERE br.electionId = :electionId AND br.verificationStatus = 'VERIFIED'")
    Long countVerifiedRecordsByElection(@Param("electionId") Long electionId);
    
    boolean existsByTrackingCode(String trackingCode);
}
