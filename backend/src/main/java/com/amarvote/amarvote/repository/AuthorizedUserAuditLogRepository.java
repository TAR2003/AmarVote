package com.amarvote.amarvote.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.AuthorizedUserAuditLog;

public interface AuthorizedUserAuditLogRepository extends JpaRepository<AuthorizedUserAuditLog, Long> {

    List<AuthorizedUserAuditLog> findTop200ByOrderByCreatedAtDesc();
}