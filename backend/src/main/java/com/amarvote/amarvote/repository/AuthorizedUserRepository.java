package com.amarvote.amarvote.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amarvote.amarvote.model.AuthorizedUser;

public interface AuthorizedUserRepository extends JpaRepository<AuthorizedUser, Long> {

    Optional<AuthorizedUser> findByEmail(String email);

    boolean existsByEmail(String email);

    Page<AuthorizedUser> findAllByOrderByEmailAsc(Pageable pageable);

    Page<AuthorizedUser> findByEmailContainingIgnoreCaseOrderByEmailAsc(String email, Pageable pageable);

    Page<AuthorizedUser> findByUserTypeInOrderByEmailAsc(List<String> userTypes, Pageable pageable);

    Page<AuthorizedUser> findByEmailContainingIgnoreCaseAndUserTypeInOrderByEmailAsc(
            String email, List<String> userTypes, Pageable pageable);

    @Query("""
            SELECT COUNT(a) FROM AuthorizedUser a
            WHERE a.lastLogin > :since
              AND a.isAllowed = true
              AND a.registeredOrNot = true
            """)
    long countActiveRegisteredUsersSince(@Param("since") Instant since);
}
