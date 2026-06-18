package com.amarvote.amarvote.service;

import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.model.AppUser;
import com.amarvote.amarvote.repository.AppUserRepository;

import lombok.RequiredArgsConstructor;

/**
 * UserDetailsService backed by the users table.
 * When registration is open to all, accepts any email from a valid JWT
 * even if the user has not completed signup yet (load tests, first-time voters).
 */
@Service
@RequiredArgsConstructor
public class MyUserDetailsService implements UserDetailsService {

    private final AppUserRepository appUserRepository;
    private final SystemSettingService systemSettingService;

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        if (email == null || email.trim().isEmpty()) {
            throw new UsernameNotFoundException("Email cannot be empty");
        }

        String normalized = email.trim().toLowerCase();
        return appUserRepository.findByEmail(normalized)
                .map(this::toUserDetails)
                .orElseGet(() -> guestUserDetailsOrThrow(normalized));
    }

    private UserDetails guestUserDetailsOrThrow(String normalizedEmail) {
        if (!systemSettingService.isRegistrationOpenToAll()) {
            throw new UsernameNotFoundException("User not found: " + normalizedEmail);
        }

        return User.withUsername(normalizedEmail)
                .password("")
                .authorities("ROLE_USER")
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(false)
                .build();
    }

    private UserDetails toUserDetails(AppUser user) {
        return User.withUsername(user.getEmail())
                .password(user.getPasswordHash())
                .authorities("ROLE_USER")
                .accountExpired(false)
                .accountLocked(false)
                .credentialsExpired(false)
                .disabled(false)
                .build();
    }
}

