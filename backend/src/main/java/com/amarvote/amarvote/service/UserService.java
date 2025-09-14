package com.amarvote.amarvote.service;

import java.time.OffsetDateTime;
import java.util.Optional;

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
import com.amarvote.amarvote.dto.UpdateProfileRequest;
import com.amarvote.amarvote.dto.UserProfileDTO;
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
        user.setCreatedAt(OffsetDateTime.now());

        // check if profilePic is provided, if not set to null
        if (request.getProfilePic() != null && !request.getProfilePic().isEmpty()) {
            user.setProfilePic(request.getProfilePic());
        } else {
            user.setProfilePic(null);
        }

        userRepository.save(user); // throws if failure
        return new RegisterResponse(true, "User registered successfully");

        // User registeredUser = userRepository.save(user);

        // if (registeredUser != null) { // successfully user has been registered
        //     return new RegisterResponse(true, "User registered successfully");
        // }

        // return new RegisterResponse(false, "User registration failed"); // failed to register user
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
    
    /**
     * Get user profile by email
     * @param email User's email
     * @return UserProfileDTO containing user profile information
     */
    public Optional<UserProfileDTO> getUserProfileByEmail(String email) {
        return userRepository.findByUserEmail(email)
                .map(user -> new UserProfileDTO(
                        user.getUserId(),
                        user.getUserEmail(),
                        user.getUserName(),
                        user.getProfilePic(),
                        user.isVerified()
                ));
    }
    
    /**
     * Update user profile
     * @param email User's email
     * @param request Update profile request containing new profile information
     * @return Updated UserProfileDTO
     */
    @Transactional
    public Optional<UserProfileDTO> updateUserProfile(String email, UpdateProfileRequest request) {
        return userRepository.findByUserEmail(email)
                .map(user -> {
                    // Update user fields if provided in the request
                    if (request.getUserName() != null && !request.getUserName().trim().isEmpty()) {
                        user.setUserName(request.getUserName());
                    }
                    
                    if (request.getProfilePic() != null) {
                        user.setProfilePic(request.getProfilePic());
                    }
                    
                    userRepository.save(user);
                    
                    return new UserProfileDTO(
                            user.getUserId(),
                            user.getUserEmail(),
                            user.getUserName(),
                            user.getProfilePic(),
                            user.isVerified()
                    );
                });
    }
}