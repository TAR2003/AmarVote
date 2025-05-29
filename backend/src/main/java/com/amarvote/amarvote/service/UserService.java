package com.amarvote.amarvote.service;

import org.springframework.stereotype.Service;

import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.UserRepository;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User findByUserEmail(String email) {
        return userRepository.findByUserEmail(email)
                .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
