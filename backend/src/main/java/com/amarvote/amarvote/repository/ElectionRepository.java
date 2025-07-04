package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amarvote.amarvote.model.Election;

// ElectionRepository.java
public interface ElectionRepository extends JpaRepository<Election, Long> {
    
    // Get all elections that are accessible to a specific user
    // This includes: 
    // 1. All public elections (elections with privacy = 'public')
    // 2. All elections where the user is in the allowed voters list
    // 3. All elections where the user is the admin (admin_email matches)
    // 4. All elections where the user is a guardian
    @Query("SELECT DISTINCT e FROM Election e " +
           "LEFT JOIN AllowedVoter av ON e.electionId = av.electionId " +
           "LEFT JOIN User u1 ON av.userId = u1.userId " +
           "LEFT JOIN Guardian g ON e.electionId = g.electionId " +
           "LEFT JOIN User u2 ON g.userId = u2.userId " +
           "WHERE " +
           "   e.privacy = 'public' " + // Public elections
           "   OR u1.userEmail = :userEmail " + // User is allowed voter
           "   OR e.adminEmail = :userEmail " + // User is admin
           "   OR u2.userEmail = :userEmail")   // User is guardian
    List<Election> findAllAccessibleElections(@Param("userEmail") String userEmail);
    
    // Get all elections where user is in allowed voters
    @Query("SELECT DISTINCT e FROM Election e " +
           "JOIN AllowedVoter av ON e.electionId = av.electionId " +
           "JOIN User u ON av.userId = u.userId " +
           "WHERE u.userEmail = :userEmail")
    List<Election> findElectionsForUser(@Param("userEmail") String userEmail);
    
    // Get all elections where user is admin
    @Query("SELECT e FROM Election e WHERE e.adminEmail = :userEmail")
    List<Election> findElectionsByAdmin(@Param("userEmail") String userEmail);
    
    // Get all elections where user is guardian
    @Query("SELECT DISTINCT e FROM Election e " +
           "JOIN Guardian g ON e.electionId = g.electionId " +
           "JOIN User u ON g.userId = u.userId " +
           "WHERE u.userEmail = :userEmail")
    List<Election> findElectionsByGuardian(@Param("userEmail") String userEmail);
}