package com.amarvote.amarvote.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.amarvote.amarvote.dto.LoginRequest;
import com.amarvote.amarvote.dto.LoginResponse;
import com.amarvote.amarvote.dto.RegisterRequest;
import com.amarvote.amarvote.dto.RegisterResponse;
import com.amarvote.amarvote.dto.UpdatePasswordRequest;
import com.amarvote.amarvote.dto.UpdateProfileRequest;
import com.amarvote.amarvote.dto.UserSession;
import com.amarvote.amarvote.service.CloudinaryService;
import com.amarvote.amarvote.service.UserService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class UserController {

    @Autowired
    private UserService userService;
    
    @Autowired
    private CloudinaryService cloudinaryService;
    
    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No active session");
        }
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String email = userDetails.getUsername();
        
        return userService.getUserProfileByEmail(email)
                .map(profile -> ResponseEntity.ok(profile))
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PutMapping("/profile")
    public ResponseEntity<?> updateUserProfile(@Valid @RequestBody UpdateProfileRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No active session");
        }
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String email = userDetails.getUsername();
        
        return userService.updateUserProfile(email, request)
                .map(profile -> ResponseEntity.ok(profile))
                .orElse(ResponseEntity.notFound().build());
    }
    
    @PutMapping("/password")
    public ResponseEntity<?> updatePassword(@Valid @RequestBody UpdatePasswordRequest request) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No active session");
        }
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String email = userDetails.getUsername();
        
        // Check if current password is valid
        if (!userService.checkPassword(email, request.getCurrentPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", "Current password is incorrect"));
        }
        
        // Check if new passwords match
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("success", false, "message", "New password and confirmation do not match"));
        }
        
        // Update password
        userService.updatePasswordByEmail(email, request.getNewPassword());
        return ResponseEntity.ok(Map.of("success", true, "message", "Password updated successfully"));
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterResponse> register(@Valid @RequestBody RegisterRequest request) {
        RegisterResponse registerResponse = userService.register(request);

        if (registerResponse.isSuccess()) {
            return ResponseEntity.ok(registerResponse);
        } else if ("User with this email already exists".equals(registerResponse.getMessage())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(registerResponse); // 409 Conflict
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(registerResponse); // 400 Bad Request
        }
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest loginRequest,
            HttpServletResponse response) {
        System.out.println("Login attempt: " + loginRequest.getEmail());
        LoginResponse loginResponse = userService.verify(loginRequest);

        if (loginResponse.isSuccess()) {
            // Generate JWT manually here since it's not returned anymore
            String jwtToken = loginResponse.getToken();

            Cookie cookie = new Cookie("jwtToken", jwtToken);
            cookie.setHttpOnly(true);
            cookie.setSecure(true); // Only over HTTPS
            cookie.setPath("/");
            cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            cookie.setAttribute("SameSite", "Strict"); // Requires Servlet 4.0+ / Tomcat 9+

            response.addCookie(cookie);
        } else {
            System.out.println("Login failed for: " + loginRequest.getEmail());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(loginResponse);
        }

        return ResponseEntity.ok(loginResponse);
    }

    // Logout moved to OtpAuthController - using OTP-based authentication now
    // @PostMapping("/logout")
    // public ResponseEntity<String> logout(HttpServletResponse response) {
    //     Cookie cookie = new Cookie("jwtToken", null);
    //     cookie.setHttpOnly(true);
    //     cookie.setSecure(true); // Only over HTTPS
    //     cookie.setPath("/");
    //     cookie.setMaxAge(0); // Set to 0 to delete the cookie
    //     cookie.setAttribute("SameSite", "Strict"); // Requires Servlet 4.0+ / Tomcat 9+
    //     response.addCookie(cookie);
    //     return ResponseEntity.ok("Logged out successfully");
    // }

    // Session check moved to OtpAuthController - using OTP-based authentication now
    // @GetMapping("/session")
    // public ResponseEntity<?> sessionCheck() {
    //     Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    //     if (authentication == null || !authentication.isAuthenticated()
    //             || "anonymousUser".equals(authentication.getPrincipal())) {
    //         return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No active session");
    //     }
    //     UserDetails userDetails = (UserDetails) authentication.getPrincipal();
    //     UserSession session = new UserSession(userDetails.getUsername());
    //     return ResponseEntity.ok(session);
    // }

    @PostMapping("/profile/upload-picture")
    public ResponseEntity<?> uploadProfilePicture(@RequestParam("file") MultipartFile file) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        
        if (authentication == null || !authentication.isAuthenticated() 
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No active session");
        }
        
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String email = userDetails.getUsername();
        
        try {
            System.out.println("Received profile image upload request. File: " + file.getOriginalFilename() + 
                             ", Size: " + file.getSize() + ", Content-Type: " + file.getContentType() + 
                             ", User: " + email);
                             
            // Upload image to Cloudinary
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.PROFILE);
            
            System.out.println("Successfully uploaded profile image to: " + imageUrl);
            
            // Update user profile with new image URL
            return userService.updateProfilePicture(email, imageUrl)
                    .map(profile -> ResponseEntity.ok(Map.of("message", "Profile picture updated successfully", 
                                                           "imageUrl", imageUrl, "user", profile)))
                    .orElse(ResponseEntity.notFound().build());
        } catch (Exception e) {
            System.err.println("Error uploading profile image: " + e.getMessage());
            e.printStackTrace();
            
            return ResponseEntity.badRequest().body(Map.of("error", "Failed to upload image: " + e.getMessage()));
        }
    }

}
