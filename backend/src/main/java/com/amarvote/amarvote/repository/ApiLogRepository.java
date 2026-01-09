package com.amarvote.amarvote.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.ApiLog;

@Repository
public interface ApiLogRepository extends JpaRepository<ApiLog, Long> {
    
    // Find all logs ordered by request time descending
    Page<ApiLog> findAllByOrderByRequestTimeDesc(Pageable pageable);
    
    // Find logs by email
    Page<ApiLog> findByExtractedEmailOrderByRequestTimeDesc(String email, Pageable pageable);
    
    // Find logs by IP
    Page<ApiLog> findByRequestIpOrderByRequestTimeDesc(String ip, Pageable pageable);
    
    // Find logs by path
    Page<ApiLog> findByRequestPathContainingOrderByRequestTimeDesc(String path, Pageable pageable);
    
    // Find logs within date range
    List<ApiLog> findByRequestTimeBetweenOrderByRequestTimeDesc(LocalDateTime start, LocalDateTime end);
    
    // Count total logs
    long count();
    
    // Custom query for statistics
    @Query("SELECT COUNT(a) FROM ApiLog a WHERE a.responseStatus >= 400")
    long countErrorLogs();
}
