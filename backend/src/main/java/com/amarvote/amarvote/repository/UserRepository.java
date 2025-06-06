package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.amarvote.amarvote.model.User;

@Repository
public interface UserRepository extends JpaRepository<User, Integer> {
    Optional<User> findByUserEmail(String userEmail);
    boolean existsByUserEmail(String userEmail);
}
