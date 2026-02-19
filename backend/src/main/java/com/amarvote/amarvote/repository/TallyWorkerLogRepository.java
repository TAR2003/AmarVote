package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.TallyWorkerLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TallyWorkerLogRepository extends JpaRepository<TallyWorkerLog, Long> {
    
    List<TallyWorkerLog> findByElectionIdOrderByStartTimeAsc(Long electionId);
    
    List<TallyWorkerLog> findByElectionIdAndStatusOrderByStartTimeAsc(Long electionId, String status);
    
    @Query("SELECT COUNT(t) FROM TallyWorkerLog t WHERE t.electionId = :electionId AND t.status = 'COMPLETED'")
    long countCompletedByElectionId(@Param("electionId") Long electionId);
}
