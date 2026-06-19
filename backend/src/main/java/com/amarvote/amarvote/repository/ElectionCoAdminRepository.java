package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amarvote.amarvote.model.ElectionCoAdmin;

public interface ElectionCoAdminRepository extends JpaRepository<ElectionCoAdmin, ElectionCoAdmin.ElectionCoAdminId> {

    List<ElectionCoAdmin> findByElectionId(Long electionId);

    boolean existsByElectionIdAndAdminEmail(Long electionId, String adminEmail);

    @Query("SELECT eca.electionId FROM ElectionCoAdmin eca WHERE eca.adminEmail = :userEmail")
    List<Long> findElectionIdsByAdminEmail(@Param("userEmail") String userEmail);
}
