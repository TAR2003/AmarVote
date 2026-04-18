package com.amarvote.amarvote.controller;

import java.util.LinkedHashMap;
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
import com.amarvote.amarvote.dto.PasswordResetWithTokenRequestDto;
import com.amarvote.amarvote.dto.ProfileMfaCodeRequestDto;
import com.amarvote.amarvote.dto.RegisterSendEmailCodeRequestDto;
import com.amarvote.amarvote.dto.RegisterVerifyEmailCodeRequestDto;
import com.amarvote.amarvote.dto.UserSession;
import com.amarvote.amarvote.service.AuthorizedUserService;
import com.amarvote.amarvote.service.EmailVerificationService;
import com.amarvote.amarvote.service.MfaAuthService;
import com.amarvote.amarvote.service.OtpAuthService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
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
    private final AuthorizedUserService authorizedUserService;
    
    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @PostMapping("/register/send-email-code")
    public ResponseEntity<?> sendRegistrationEmailCode(@Valid @RequestBody RegisterSendEmailCodeRequestDto request) {
        try {
            authorizedUserService.ensureAllowedForRegistration(request.getEmail());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", ex.getMessage()));
        }

        emailVerificationService.sendEmailVerificationCode(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "status", "EMAIL_CODE_SENT",
                "message", "Verification code sent"));
    }

    @PostMapping("/password/send-email-code")
    public ResponseEntity<?> sendPasswordResetEmailCode(@Valid @RequestBody RegisterSendEmailCodeRequestDto request) {
        String normalizedEmail = request.getEmail().trim().toLowerCase();

        try {
            authorizedUserService.ensureAllowedForLogin(normalizedEmail);
            emailVerificationService.sendPasswordResetCode(normalizedEmail);
            return ResponseEntity.ok(Map.of(
                    "status", "PASSWORD_RESET_CODE_SENT",
                    "message", "Password reset verification code sent"));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/password/verify-email-code")
        public ResponseEntity<?> verifyPasswordResetEmailCode(
            @Valid @RequestBody RegisterVerifyEmailCodeRequestDto request,
            HttpServletResponse response) {
        try {
            authorizedUserService.ensureAllowedForLogin(request.getEmail());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", ex.getMessage()));
        }

        Optional<String> tokenOpt = emailVerificationService.verifyPasswordResetCodeAndIssueToken(
                request.getEmail(), request.getCode());

        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid or expired verification code"));
        }

        addTempCookie(response, "passwordResetToken", tokenOpt.get(), 10 * 60);

        return ResponseEntity.ok(Map.of(
                "status", "PASSWORD_RESET_CODE_VERIFIED",
                "message", "Verification successful. You can now reset your password."));
    }

    @PostMapping("/password/reset")
    public ResponseEntity<?> resetPassword(
            @Valid @RequestBody PasswordResetWithTokenRequestDto request,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        try {
            String resetToken = request.getResetPasswordToken();
            if (resetToken == null || resetToken.isBlank()) {
                resetToken = readCookie(httpRequest, "passwordResetToken");
            }

            if (resetToken == null || resetToken.isBlank()) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("message", "Reset token is required"));
            }

            mfaAuthService.resetPasswordWithToken(resetToken, request.getNewPassword());
            clearCookie(response, "passwordResetToken");
            return ResponseEntity.ok(Map.of(
                    "status", "PASSWORD_RESET_SUCCESS",
                    "message", "Password reset successful. You can now log in."));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("message", ex.getMessage()));
        }
    }

    @PostMapping("/register/verify-email-code")
    public ResponseEntity<?> verifyRegistrationEmailCode(
            @Valid @RequestBody RegisterVerifyEmailCodeRequestDto request,
            HttpServletResponse response) {
        Optional<String> tokenOpt = emailVerificationService.verifyEmailCodeAndIssueToken(request.getEmail(), request.getCode());
        if (tokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid or expired verification code"));
        }

        addTempCookie(response, "emailVerificationToken", tokenOpt.get(), 10 * 60);

        return ResponseEntity.ok(Map.of(
                "status", "EMAIL_VERIFIED",
                "message", "Email verified successfully"));
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody AuthRegisterRequestDto request,
            HttpServletRequest httpRequest,
            HttpServletResponse response) {
        try {
            authorizedUserService.ensureAllowedForRegistration(request.getEmail());
            boolean enableMfa = Boolean.TRUE.equals(request.getEnableMfa());

            String emailVerificationToken = request.getEmailVerificationToken();
            if (emailVerificationToken == null || emailVerificationToken.isBlank()) {
                emailVerificationToken = readCookie(httpRequest, "emailVerificationToken");
            }

            Map<String, Object> responseMap = mfaAuthService.registerAndStartMfaSetup(
                    request.getEmail(),
                    request.getPassword(),
                    emailVerificationToken,
                    enableMfa);

            if ("REGISTERED_NO_MFA".equals(responseMap.get("status")) && responseMap.get("token") != null) {
                addAuthCookie(response, String.valueOf(responseMap.get("token")));
            }

            clearCookie(response, "emailVerificationToken");

            return ResponseEntity.ok(sanitizeTokenResponse(responseMap));
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
        clearCookie(response, "mfaTempToken");

        return ResponseEntity.ok(Map.of(
            "status", "REGISTERED_MFA_SUCCESS",
                "message", "Registration complete"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginStepOne(@Valid @RequestBody AuthLoginRequestDto request, HttpServletResponse response) {
        try {
            Optional<Map<String, Object>> responseOpt = mfaAuthService.loginStepOne(request.getEmail(), request.getPassword());
            if (responseOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Invalid credentials"));
            }

            Map<String, Object> responseMap = responseOpt.get();
            Object status = responseMap.get("status");
            if ("MFA_REQUIRED".equals(status)) {
                if (responseMap.get("tempToken") != null) {
                    addTempCookie(response, "mfaTempToken", String.valueOf(responseMap.get("tempToken")), 2 * 60);
                }
                return ResponseEntity.status(HttpStatus.ACCEPTED).body(sanitizeTokenResponse(responseMap));
            }

            if ("LOGIN_SUCCESS".equals(status) && responseMap.get("token") != null) {
                addAuthCookie(response, String.valueOf(responseMap.get("token")));
                clearCookie(response, "mfaTempToken");
                return ResponseEntity.ok(sanitizeTokenResponse(responseMap));
            }

            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(sanitizeTokenResponse(responseMap));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", ex.getMessage()));
        }
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
            HttpServletRequest httpRequest,
            HttpServletResponse response) {

        String tempToken = null;
        if (authorization != null && authorization.startsWith("Bearer ")) {
            tempToken = authorization.substring(7);
        }

        if (tempToken == null || tempToken.isBlank()) {
            tempToken = readCookie(httpRequest, "mfaTempToken");
        }

        if (tempToken == null || tempToken.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Missing temporary token"));
        }

        Optional<String> finalTokenOpt = mfaAuthService.verifyMfaAndIssueFinalToken(tempToken, request.getTotpCode());
        if (finalTokenOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid MFA code or expired token"));
        }

        String finalToken = finalTokenOpt.get();
        addAuthCookie(response, finalToken);
        clearCookie(response, "mfaTempToken");

        return ResponseEntity.ok(Map.of(
                "message", "Login successful"));
    }

    /**
     * Request OTP code to be sent to email
     */
    @PostMapping("/request-otp")
    public ResponseEntity<OtpResponseDto> requestOtp(@Valid @RequestBody OtpRequestDto request) {
        try {
            authorizedUserService.ensureAllowedForLogin(request.getEmail());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new OtpResponseDto(false, ex.getMessage()));
        }

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

        try {
            authorizedUserService.ensureAllowedForLogin(request.getEmail());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new OtpLoginResponseDto(false, ex.getMessage()));
        }
        
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

            authorizedUserService.markSuccessfulLogin(request.getEmail());
            
            return ResponseEntity.ok(new OtpLoginResponseDto(true, "Login successful"));
        } else {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new OtpLoginResponseDto(false, "Invalid or expired OTP"));
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
        String email = userDetails.getUsername();
        Map<String, Object> access = authorizedUserService.getCurrentUserAccess(email);
        UserSession session = new UserSession(
            email,
            String.valueOf(access.getOrDefault("userType", "user")),
            Boolean.TRUE.equals(access.get("canViewApiLogs")),
            Boolean.TRUE.equals(access.get("canManageAuthorizedUsers")));

        return ResponseEntity.ok(session);
    }

    /**
     * Logout endpoint
     */
    @PostMapping("/logout")
    public ResponseEntity<OtpResponseDto> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("jwtToken", null);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0); // Delete cookie
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);

        clearCookie(response, "mfaTempToken");
        clearCookie(response, "emailVerificationToken");
        clearCookie(response, "passwordResetToken");
        
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

    private void addTempCookie(HttpServletResponse response, String cookieName, String token, int maxAgeSeconds) {
        Cookie cookie = new Cookie(cookieName, token);
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(maxAgeSeconds);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private void clearCookie(HttpServletResponse response, String cookieName) {
        Cookie cookie = new Cookie(cookieName, "");
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }

    private String readCookie(HttpServletRequest request, String cookieName) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }

        for (Cookie cookie : cookies) {
            if (cookieName.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private Map<String, Object> sanitizeTokenResponse(Map<String, Object> responseMap) {
        Map<String, Object> sanitized = new LinkedHashMap<>(responseMap);
        sanitized.remove("token");
        sanitized.remove("tempToken");
        return sanitized;
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
