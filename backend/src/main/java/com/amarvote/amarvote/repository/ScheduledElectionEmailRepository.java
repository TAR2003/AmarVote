package com.amarvote.amarvote.repository;

import java.time.Instant;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.ScheduledElectionEmail;

public interface ScheduledElectionEmailRepository extends JpaRepository<ScheduledElectionEmail, Long> {

    List<ScheduledElectionEmail> findByElectionIdOrderByScheduledTimeDesc(Long electionId);

    List<ScheduledElectionEmail> findByScheduledTimeLessThanEqualAndSentFalse(Instant now);
}
