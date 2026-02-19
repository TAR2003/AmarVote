package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.ElectionJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ElectionJobRepository extends JpaRepository<ElectionJob, UUID> {
    
    /**
     * Find all jobs for an election
     */
    List<ElectionJob> findByElectionIdOrderByStartedAtDesc(Long electionId);
    
    /**
     * Find jobs by election ID and operation type (returns most recent)
     */
    Optional<ElectionJob> findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(Long electionId, String operationType);
    
    /**
     * Find active jobs (not completed or failed)
     */
    @Query("SELECT j FROM ElectionJob j WHERE j.status IN ('QUEUED', 'IN_PROGRESS')")
    List<ElectionJob> findActiveJobs();
    
    /**
     * Find jobs by status
     */
    List<ElectionJob> findByStatus(String status);
    
    /**
     * Check if a job exists for election and operation
     */
    @Query("SELECT CASE WHEN COUNT(j) > 0 THEN true ELSE false END FROM ElectionJob j " +
           "WHERE j.electionId = :electionId AND j.operationType = :operationType " +
           "AND j.status IN ('QUEUED', 'IN_PROGRESS')")
    boolean existsActiveJob(@Param("electionId") Long electionId, 
                           @Param("operationType") String operationType);
}
