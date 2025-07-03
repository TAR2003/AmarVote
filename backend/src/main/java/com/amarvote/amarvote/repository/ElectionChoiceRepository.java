package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.ElectionChoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ElectionChoiceRepository extends JpaRepository<ElectionChoice, Long> {
}

