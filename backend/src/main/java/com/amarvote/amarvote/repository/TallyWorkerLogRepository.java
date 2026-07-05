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

    @Query("SELECT COUNT(t) FROM TallyWorkerLog t WHERE t.electionId = :electionId")
    long countByElectionId(@Param("electionId") Long electionId);

    @Query("SELECT COUNT(t) FROM TallyWorkerLog t WHERE t.electionId = :electionId AND t.status = 'IN_PROGRESS'")
    long countInProgressByElectionId(@Param("electionId") Long electionId);

    @Query("SELECT t.chunkNumber FROM TallyWorkerLog t WHERE t.electionId = :electionId AND t.status = 'COMPLETED'")
    List<Integer> findCompletedChunkNumbersByElectionId(@Param("electionId") Long electionId);

    @Query("SELECT COUNT(t) > 0 FROM TallyWorkerLog t WHERE t.electionId = :electionId AND t.chunkNumber = :chunkNumber AND t.status = :status")
    boolean existsByElectionIdAndChunkNumberAndStatus(
        @Param("electionId") Long electionId,
        @Param("chunkNumber") Integer chunkNumber,
        @Param("status") String status);

    void deleteByElectionId(Long electionId);
}
