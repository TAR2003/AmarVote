package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amarvote.amarvote.model.AuthorizedUserAuditLog;

public interface AuthorizedUserAuditLogRepository extends JpaRepository<AuthorizedUserAuditLog, Long> {

    List<AuthorizedUserAuditLog> findTop200ByOrderByCreatedAtDesc();

    Page<AuthorizedUserAuditLog> findAllByOrderByCreatedAtDesc(Pageable pageable);

    @Query("""
            SELECT l FROM AuthorizedUserAuditLog l
            WHERE (:search IS NULL OR :search = ''
                OR LOWER(l.actorEmail) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(l.targetEmail) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(l.actionType) LIKE LOWER(CONCAT('%', :search, '%'))
                OR LOWER(l.details) LIKE LOWER(CONCAT('%', :search, '%')))
            ORDER BY l.createdAt DESC
            """)
    Page<AuthorizedUserAuditLog> searchLogs(@Param("search") String search, Pageable pageable);
}