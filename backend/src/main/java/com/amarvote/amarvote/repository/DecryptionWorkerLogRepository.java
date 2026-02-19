package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.DecryptionWorkerLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DecryptionWorkerLogRepository extends JpaRepository<DecryptionWorkerLog, Long> {
    
    List<DecryptionWorkerLog> findByElectionIdOrderByStartTimeAsc(Long electionId);
    
    List<DecryptionWorkerLog> findByElectionIdAndDecryptionTypeOrderByStartTimeAsc(Long electionId, String decryptionType);
    
    List<DecryptionWorkerLog> findByElectionIdAndStatusOrderByStartTimeAsc(Long electionId, String status);
    
    @Query("SELECT COUNT(d) FROM DecryptionWorkerLog d WHERE d.electionId = :electionId AND d.decryptionType = :decryptionType AND d.status = 'COMPLETED'")
    long countCompletedByElectionIdAndType(@Param("electionId") Long electionId, @Param("decryptionType") String decryptionType);
}
