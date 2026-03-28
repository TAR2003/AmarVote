package com.amarvote.amarvote.controller;

import java.util.Map;
import java.util.Optional;

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
import com.amarvote.amarvote.dto.ChangePasswordRequestDto;
import com.amarvote.amarvote.dto.MfaConfirmSetupRequestDto;
import com.amarvote.amarvote.dto.MfaVerifyRequestDto;
import com.amarvote.amarvote.dto.OtpLoginResponseDto;
import com.amarvote.amarvote.dto.OtpRequestDto;
import com.amarvote.amarvote.dto.OtpResponseDto;
import com.amarvote.amarvote.dto.OtpVerifyDto;
import com.amarvote.amarvote.dto.ProfileMfaCodeRequestDto;
import com.amarvote.amarvote.dto.RegisterSendEmailCodeRequestDto;
import com.amarvote.amarvote.dto.RegisterVerifyEmailCodeRequestDto;
import com.amarvote.amarvote.dto.UserSession;
import com.amarvote.amarvote.service.EmailVerificationService;
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

    private final EmailVerificationService emailVerificationService;
    private final MfaAuthService mfaAuthService;
    
    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @PostMapping("/register/send-email-code")
    public ResponseEntity<?> sendRegistrationEmailCode(@Valid @RequestBody RegisterSendEmailCodeRequestDto request) {
        emailVerificationService.sendEmailVerificationCode(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "status", "EMAIL_CODE_SENT",
                "message", "Verification code sent"));
    }

    @PostMapping("/register/verify-email-code")
    public ResponseEntity<?> verifyRegistrationEmailCode(@Valid @RequestBody RegisterVerifyEmailCodeRequestDto request) {
        Optional<String> tokenOpt = emailVerificationService.verifyEmailCodeAndIssueToken(request.getEmail(), request.getCode());
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid or expired verification code"));
        }

        return ResponseEntity.ok(Map.of(
                "status", "EMAIL_VERIFIED",
                "emailVerificationToken", tokenOpt.get()));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRegisterRequestDto request, HttpServletResponse response) {
        try {
            boolean enableMfa = Boolean.TRUE.equals(request.getEnableMfa());
            Map<String, Object> responseMap = mfaAuthService.registerAndStartMfaSetup(
                    request.getEmail(),
                    request.getPassword(),
                    request.getEmailVerificationToken(),
                    enableMfa);

            if ("REGISTERED_NO_MFA".equals(responseMap.get("status")) && responseMap.get("token") != null) {
                addAuthCookie(response, String.valueOf(responseMap.get("token")));
            }

            return ResponseEntity.ok(responseMap);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
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
    public ResponseEntity<?> loginStepOne(@Valid @RequestBody AuthLoginRequestDto request, HttpServletResponse response) {
        Optional<Map<String, Object>> responseOpt = mfaAuthService.loginStepOne(request.getEmail(), request.getPassword());
        if (responseOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid credentials"));
        }

        Map<String, Object> responseMap = responseOpt.get();
        Object status = responseMap.get("status");
        if ("MFA_REQUIRED".equals(status)) {
            return ResponseEntity.status(HttpStatus.ACCEPTED).body(responseMap);
        }

        if ("LOGIN_SUCCESS".equals(status) && responseMap.get("token") != null) {
            addAuthCookie(response, String.valueOf(responseMap.get("token")));
            return ResponseEntity.ok(responseMap);
        }

        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(responseMap);
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getProfileSettings() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        return ResponseEntity.ok(mfaAuthService.getProfileSettings(userEmail));
    }

    @PostMapping("/profile/password")
    public ResponseEntity<?> changePassword(@Valid @RequestBody ChangePasswordRequestDto request) {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        try {
            mfaAuthService.changePassword(userEmail, request.getCurrentPassword(), request.getNewPassword());
            return ResponseEntity.ok(Map.of("success", true, "message", "Password updated successfully"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/profile/mfa/setup")
    public ResponseEntity<?> startProfileMfaSetup() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        return ResponseEntity.ok(mfaAuthService.startProfileMfaSetup(userEmail));
    }

    @PostMapping("/profile/mfa/confirm")
    public ResponseEntity<?> confirmProfileMfa(@Valid @RequestBody ProfileMfaCodeRequestDto request) {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        boolean success = mfaAuthService.confirmProfileMfaSetup(userEmail, request.getTotpCode());
        if (!success) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", "Invalid 2FA code"));
        }

        return ResponseEntity.ok(Map.of("success", true, "message", "2FA enabled successfully"));
    }

    @PostMapping("/profile/mfa/disable")
    public ResponseEntity<?> disableProfileMfa() {
        String userEmail = getAuthenticatedEmail();
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Unauthorized"));
        }

        mfaAuthService.disableProfileMfa(userEmail);
        return ResponseEntity.ok(Map.of("success", true, "message", "2FA disabled successfully"));
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

    private String getAuthenticatedEmail() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return null;
        }

        Object principal = authentication.getPrincipal();
        if (principal instanceof UserDetails userDetails) {
            return userDetails.getUsername();
        }

        return authentication.getName();
    }

}
