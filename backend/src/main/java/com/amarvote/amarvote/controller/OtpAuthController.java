package com.amarvote.amarvote.controller;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.OtpLoginResponseDto;
import com.amarvote.amarvote.dto.OtpRequestDto;
import com.amarvote.amarvote.dto.OtpResponseDto;
import com.amarvote.amarvote.dto.OtpVerifyDto;
import com.amarvote.amarvote.dto.UserSession;
import com.amarvote.amarvote.service.OtpAuthService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/auth")
public class OtpAuthController {

    @Autowired
    private OtpAuthService otpAuthService;

    /**
     * Request OTP code to be sent to email
     */
    @PostMapping("/request-otp")
    public ResponseEntity<OtpResponseDto> requestOtp(@Valid @RequestBody OtpRequestDto request) {
        boolean success = otpAuthService.sendOtp(request.getEmail());
        
        if (success) {
            return ResponseEntity.ok(new OtpResponseDto(true, "OTP sent to your email"));
        } else {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new OtpResponseDto(false, "Failed to send OTP"));
        }
    }

    /**
     * Verify OTP and login
     */
    @PostMapping("/verify-otp")
    public ResponseEntity<OtpLoginResponseDto> verifyOtp(
            @Valid @RequestBody OtpVerifyDto request,
            HttpServletResponse response) {
        
        Optional<String> tokenOpt = otpAuthService.verifyOtpAndGenerateToken(
                request.getEmail(), request.getOtpCode());
        
        if (tokenOpt.isPresent()) {
            String token = tokenOpt.get();
            
            // Set HTTP-only cookie
            Cookie cookie = new Cookie("jwtToken", token);
            cookie.setHttpOnly(true);
            cookie.setSecure(true); // Only over HTTPS
            cookie.setPath("/");
            cookie.setMaxAge(7 * 24 * 60 * 60); // 7 days
            cookie.setAttribute("SameSite", "Strict");
            response.addCookie(cookie);
            
            return ResponseEntity.ok(new OtpLoginResponseDto(true, "Login successful", token));
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new OtpLoginResponseDto(false, "Invalid or expired OTP", null));
        }
    }

    /**
     * Check current session
     */
    @GetMapping("/session")
    public ResponseEntity<?> sessionCheck() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body("No active session");
        }

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        UserSession session = new UserSession(userDetails.getUsername());

        return ResponseEntity.ok(session);
    }

    /**
     * Logout endpoint
     */
    @PostMapping("/logout")
    public ResponseEntity<OtpResponseDto> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwtToken", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(true);
        cookie.setPath("/");
        cookie.setMaxAge(0); // Delete cookie
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
        
        return ResponseEntity.ok(new OtpResponseDto(true, "Logged out successfully"));
    }
}
