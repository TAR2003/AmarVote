package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.domain.Pageable;
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
           "LEFT JOIN Guardian g ON e.electionId = g.electionId " +
           "WHERE " +
           "   e.privacy = 'public' " + // Public elections
           "   OR av.userEmail = :userEmail " + // User is allowed voter
           "   OR e.adminEmail = :userEmail " + // User is admin
           "   OR g.userEmail = :userEmail")   // User is guardian
    List<Election> findAllAccessibleElections(@Param("userEmail") String userEmail);
    
    /**
     * Optimized query to fetch all elections accessible to a user with all the necessary related data
     * in a single database query to avoid N+1 problem when displaying hundreds of elections.
     * 
     * This returns:
     * 1. All public elections OR private elections where the user is involved
     * 2. User's role information for each election (admin, voter, guardian)
     * 3. Admin name for each election
     * 4. Whether the user has already voted
     */
    @Query(value = 
            // Main election data
            "WITH accessible_elections AS (" +
            "    SELECT DISTINCT e.* FROM elections e " +
            "    LEFT JOIN allowed_voters av ON e.election_id = av.election_id " +
            "    LEFT JOIN guardians g ON e.election_id = g.election_id " +
            "    WHERE " +
            "        e.privacy = 'public' OR " +
            "        av.user_email = :userEmail OR " +
            "        e.admin_email = :userEmail OR " +
            "        g.user_email = :userEmail" +
            "), " +
            // Admin data - admin_email is stored directly in elections table
            "admin_info AS (" +
            "    SELECT e.election_id, e.admin_email as admin_name " +
            "    FROM accessible_elections e" +
            "), " +
            // User role data
            "user_roles AS (" +
            "    SELECT e.election_id, " +
            "        CASE WHEN e.admin_email = :userEmail THEN true ELSE false END AS is_admin, " +
            "        EXISTS (SELECT 1 FROM guardians g " +
            "               WHERE g.election_id = e.election_id AND g.user_email = :userEmail) AS is_guardian, " +
            "        EXISTS (SELECT 1 FROM allowed_voters av " +
            "               WHERE av.election_id = e.election_id AND av.user_email = :userEmail) AS is_voter " +
            "    FROM accessible_elections e" +
            "), " +
            // Voting status data
            "vote_status AS (" +
            "    SELECT av.election_id, av.has_voted " +
            "    FROM allowed_voters av " +
            "    WHERE av.user_email = :userEmail" +
            ") " +
            // Final combined query
            "SELECT e.*, " +
            "    a.admin_name, " +
            "    r.is_admin, r.is_guardian, r.is_voter, " +
            "    COALESCE(v.has_voted, false) as has_voted " +
            "FROM accessible_elections e " +
            "LEFT JOIN admin_info a ON e.election_id = a.election_id " +
            "LEFT JOIN user_roles r ON e.election_id = r.election_id " +
            "LEFT JOIN vote_status v ON e.election_id = v.election_id " +
            "ORDER BY e.created_at DESC", 
            nativeQuery = true)
    List<Object[]> findOptimizedAccessibleElectionsWithDetails(@Param("userEmail") String userEmail);
    
    // Get all elections where user is in allowed voters
    @Query("SELECT DISTINCT e FROM Election e " +
           "JOIN AllowedVoter av ON e.electionId = av.electionId " +
           "WHERE av.userEmail = :userEmail")
    List<Election> findElectionsForUser(@Param("userEmail") String userEmail);
    
    // Get all elections where user is admin
    @Query("SELECT e FROM Election e WHERE e.adminEmail = :userEmail")
    List<Election> findElectionsByAdmin(@Param("userEmail") String userEmail);
    
    // Get all elections where user is guardian
    @Query("SELECT DISTINCT e FROM Election e " +
           "JOIN Guardian g ON e.electionId = g.electionId " +
           "WHERE g.userEmail = :userEmail")
    List<Election> findElectionsByGuardian(@Param("userEmail") String userEmail);
    
    // Find elections by status
    @Query("SELECT e FROM Election e WHERE e.status = :status")
    List<Election> findByStatus(@Param("status") String status);
    
    // Find public completed/decrypted elections for chatbot
    @Query("SELECT e FROM Election e WHERE e.status IN ('completed', 'decrypted') AND e.privacy = 'public' ORDER BY e.endingTime DESC")
    List<Election> findPublicCompletedElections();
    
    // Find the most recent public completed/decrypted election
    @Query("SELECT e FROM Election e WHERE e.status IN ('completed', 'decrypted') AND e.privacy = 'public' ORDER BY e.endingTime DESC")
    List<Election> findMostRecentPublicCompletedElection(Pageable pageable);
}