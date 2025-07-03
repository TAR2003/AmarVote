package com.amarvote.amarvote.repository;

import com.amarvote.amarvote.model.AllowedVoter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AllowedVoterRepository extends JpaRepository<AllowedVoter, Long> {
}

