package com.amarvote.amarvote.controller;

import java.util.Optional;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.AuthLoginRequestDto;
import com.amarvote.amarvote.dto.AuthRegisterRequestDto;
import com.amarvote.amarvote.dto.MfaConfirmSetupRequestDto;
import com.amarvote.amarvote.dto.MfaVerifyRequestDto;
import com.amarvote.amarvote.dto.OtpLoginResponseDto;
import com.amarvote.amarvote.dto.OtpRequestDto;
import com.amarvote.amarvote.dto.OtpResponseDto;
import com.amarvote.amarvote.dto.OtpVerifyDto;
import com.amarvote.amarvote.dto.UserSession;
import com.amarvote.amarvote.service.MfaAuthService;
import com.amarvote.amarvote.service.OtpAuthService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class OtpAuthController {

    @Autowired
    private OtpAuthService otpAuthService;

    private final MfaAuthService mfaAuthService;
    
    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRegisterRequestDto request) {
        try {
            Map<String, Object> response = mfaAuthService.registerAndStartMfaSetup(
                    request.getEmail(),
                    request.getPassword());
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/mfa/confirm-setup")
    public ResponseEntity<?> confirmMfaSetup(
            @Valid @RequestBody MfaConfirmSetupRequestDto request,
            HttpServletResponse response) {

        Optional<String> tokenOpt = mfaAuthService.confirmMfaSetup(request.getEmail(), request.getTotpCode());
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid setup code"));
        }

        String token = tokenOpt.get();
        addAuthCookie(response, token);

        return ResponseEntity.ok(Map.of(
                "token", token,
                "message", "Registration complete"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginStepOne(@Valid @RequestBody AuthLoginRequestDto request) {
        Optional<Map<String, Object>> responseOpt = mfaAuthService.loginStepOne(request.getEmail(), request.getPassword());
        if (responseOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid credentials"));
        }

        Map<String, Object> response = responseOpt.get();
        Object status = response.get("status");
        if ("MFA_REQUIRED".equals(status)) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(response);
        }

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<?> verifyMfa(
            @Valid @RequestBody MfaVerifyRequestDto request,
            @RequestHeader(value = "Authorization", required = false) String authorization,
            HttpServletResponse response) {

        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Missing temporary token"));
        }

        String tempToken = authorization.substring(7);
        Optional<String> finalTokenOpt = mfaAuthService.verifyMfaAndIssueFinalToken(tempToken, request.getTotpCode());
        if (finalTokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid MFA code or expired token"));
        }

        String finalToken = finalTokenOpt.get();
        addAuthCookie(response, finalToken);

        return ResponseEntity.ok(Map.of(
                "token", finalToken,
                "message", "Login successful"));
    }

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
            cookie.setSecure(cookieSecure); // Configurable via application.properties
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

    private void addAuthCookie(HttpServletResponse response, String token) {
        Cookie cookie = new Cookie("jwtToken", token);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(7 * 24 * 60 * 60);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }
}
