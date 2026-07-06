package com.amarvote.amarvote.model;

import java.io.Serializable;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "election_co_admins", indexes = {
    @Index(name = "idx_election_co_admins_admin_email", columnList = "admin_email")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@IdClass(ElectionCoAdmin.ElectionCoAdminId.class)
public class ElectionCoAdmin {

    @Id
    @Column(name = "election_id", nullable = false)
    private Long electionId;

    @Id
    @Column(name = "admin_email", nullable = false, columnDefinition = "TEXT")
    private String adminEmail;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ElectionCoAdminId implements Serializable {
        private Long electionId;
        private String adminEmail;
    }
}
