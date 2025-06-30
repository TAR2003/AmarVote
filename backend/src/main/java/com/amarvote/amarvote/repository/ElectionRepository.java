package com.amarvote.amarvote.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.Election;

// ElectionRepository.java
public interface ElectionRepository extends JpaRepository<Election, Long> {
    // Custom queries if needed
}