package com.amarvote.amarvote.service;

import java.time.OffsetDateTime;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.LoginRequest;
import com.amarvote.amarvote.dto.LoginResponse;
import com.amarvote.amarvote.dto.RegisterRequest;
import com.amarvote.amarvote.dto.RegisterResponse;
import com.amarvote.amarvote.model.User;
import com.amarvote.amarvote.repository.UserRepository;

@Service
public class UserService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JWTService jwtService;

    @Autowired
    private AuthenticationManager authenticationManager;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);

    public RegisterResponse register(RegisterRequest request) {
        // Password and Confirm Password match check
        if (!request.getPassword().equals(request.getConfirmPassword())) {
            return new RegisterResponse(false, "Password and Confirm Password do not match");
        }

        // Optional: check if user already exists by email
        if (userRepository.findByUserEmail(request.getEmail()).isPresent()) {
            return new RegisterResponse(false, "User with this email already exists");
            // throw new IllegalArgumentException("User with this email already exists");
        }
        User user = new User();
        user.setUserName(request.getUserName());
        user.setUserEmail(request.getEmail());
        user.setVerified(false);
        user.setPasswordHash(encoder.encode(request.getPassword()));
        user.setNid(request.getNid());
        user.setCreatedAt(OffsetDateTime.now());

        // check if profilePic is provided, if not set to null
        if (request.getProfilePic() != null && !request.getProfilePic().isEmpty()) {
            user.setProfilePic(request.getProfilePic());
        } else {
            user.setProfilePic(null);
        }

        User registeredUser = userRepository.save(user);

        if (registeredUser != null) { // successfully user has been registered
            return new RegisterResponse(true, "User registered successfully");
        }

        return new RegisterResponse(false, "User registration failed"); // failed to register user
    }

    public LoginResponse verify(LoginRequest request) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

            // If no exception, authentication successful
            String jwtToken = jwtService.generateJWTToken(request.getEmail());
            System.out.println("Generated JWT Token: " + jwtToken);
            return new LoginResponse(jwtToken, request.getEmail(), true, "User login successful");
        } catch (AuthenticationException ex) {
            return new LoginResponse(null, null, false, "Invalid email or password");
        }
    }

    public boolean existsByEmail(String email) {
        return userRepository.existsByUserEmail(email);
    }

    public boolean checkPassword(String email, String password) {
        return userRepository.findByUserEmail(email)
                .map(user -> encoder.matches(password, user.getPassword()))
                .orElse(false);
    }

    @Transactional
    public void updatePasswordByEmail(String email, String newPassword) {
        userRepository.findByUserEmail(email).ifPresent(user -> {
            user.setPasswordHash(encoder.encode(newPassword));
            userRepository.save(user);
        });
    }

    public String getJwtToken(String email) {
        return jwtService.generateJWTToken(email);
    }
}