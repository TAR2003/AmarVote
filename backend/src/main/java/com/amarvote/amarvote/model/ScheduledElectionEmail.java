package com.amarvote.amarvote.model;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "scheduled_election_emails")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduledElectionEmail {

    public static final String GROUP_VOTERS = "voters";
    public static final String GROUP_GUARDIANS = "guardians";
    public static final String GROUP_ADMINS = "admins";

    public static final String VOTER_FILTER_BOTH = "both";
    public static final String VOTER_FILTER_VOTED = "voted";
    public static final String VOTER_FILTER_NOT_VOTED = "not_voted";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "email_id")
    private Long emailId;

    @Column(name = "election_id", nullable = false)
    private Long electionId;

    /** One of: voters, guardians, admins (includes co-admins). */
    @Column(name = "recipient_group", nullable = false, columnDefinition = "TEXT")
    private String recipientGroup;

    /**
     * When {@code recipient_group} is voters: both (default), voted, or not_voted.
     */
    @Column(name = "voter_filter", columnDefinition = "TEXT")
    @Builder.Default
    private String voterFilter = VOTER_FILTER_BOTH;

    @Column(name = "email_body", nullable = false, columnDefinition = "TEXT")
    private String emailBody;

    @Column(name = "scheduled_time", nullable = false)
    private Instant scheduledTime;

    @Column(name = "sent", nullable = false)
    @Builder.Default
    private Boolean sent = false;

    @Column(name = "sent_at")
    private Instant sentAt;

    @Column(name = "created_at", updatable = false)
    @CreationTimestamp
    private Instant createdAt;
}
