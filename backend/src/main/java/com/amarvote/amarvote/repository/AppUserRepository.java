package com.amarvote.amarvote.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.amarvote.amarvote.model.AppUser;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);

    @Query(value = "SELECT * FROM users WHERE mfa_secret IS NOT NULL AND LENGTH(TRIM(mfa_secret)) < 40", nativeQuery = true)
    java.util.List<AppUser> findUsersWithPlaintextMfaSecrets();

    @Modifying
    @Query(value = "UPDATE users SET mfa_secret = :encryptedSecret WHERE user_id = :userId", nativeQuery = true)
    int updateMfaSecretRaw(@Param("userId") Long userId, @Param("encryptedSecret") String encryptedSecret);
}
