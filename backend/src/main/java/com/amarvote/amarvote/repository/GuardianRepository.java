package com.amarvote.amarvote.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.Guardian;

@Repository
public interface GuardianRepository extends JpaRepository<Guardian, Long> {
    // Add custom queries if needed
}
