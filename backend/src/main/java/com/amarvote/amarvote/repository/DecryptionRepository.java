package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.Decryption;

@Repository
public interface DecryptionRepository extends JpaRepository<Decryption, Long> {
    List<Decryption> findByElectionCenterId(Long electionCenterId);
    List<Decryption> findByGuardianId(Long guardianId);
    List<Decryption> findByElectionCenterIdAndGuardianId(Long electionCenterId, Long guardianId);
    boolean existsByGuardianIdAndElectionCenterId(Long guardianId, Long electionCenterId);
}
