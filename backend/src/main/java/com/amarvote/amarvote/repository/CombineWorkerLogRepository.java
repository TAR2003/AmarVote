package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.CombineWorkerLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CombineWorkerLogRepository extends JpaRepository<CombineWorkerLog, Long> {
    
    List<CombineWorkerLog> findByElectionIdOrderByStartTimeAsc(Long electionId);
    
    List<CombineWorkerLog> findByElectionIdAndStatusOrderByStartTimeAsc(Long electionId, String status);
    
    @Query("SELECT COUNT(c) FROM CombineWorkerLog c WHERE c.electionId = :electionId AND c.status = 'COMPLETED'")
    long countCompletedByElectionId(@Param("electionId") Long electionId);
}
