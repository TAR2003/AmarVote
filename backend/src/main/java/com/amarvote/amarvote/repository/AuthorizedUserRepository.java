package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.AuthorizedUser;

public interface AuthorizedUserRepository extends JpaRepository<AuthorizedUser, Long> {

    Optional<AuthorizedUser> findByEmail(String email);

    boolean existsByEmail(String email);
}