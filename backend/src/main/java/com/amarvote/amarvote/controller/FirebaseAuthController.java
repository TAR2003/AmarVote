package com.amarvote.amarvote.controller;

import java.time.Duration;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.OtpResponseDto;
import com.amarvote.amarvote.service.FirebaseAuthService;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

@RestController
@RequestMapping("/api/auth")
public class FirebaseAuthController {

    @Autowired
    private FirebaseAuthService firebaseAuthService;

    @Value("${cookie.secure:false}")
    private boolean cookieSecure;

    @Value("${jwt.expiration}")
    private long jwtExpirationMillis;

    @PostMapping("/firebase-login")
    public ResponseEntity<OtpResponseDto> firebaseLogin(
            @RequestHeader(value = "Authorization", required = false) String authorizationHeader,
            HttpServletResponse response) {

        String firebaseIdToken = extractBearerToken(authorizationHeader);
        if (firebaseIdToken == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new OtpResponseDto(false, "Missing or invalid Firebase token"));
        }

        Optional<String> amarVoteJwtOpt = firebaseAuthService.verifyFirebaseIdTokenAndCreateSessionJwt(firebaseIdToken);
        if (amarVoteJwtOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new OtpResponseDto(false, "Invalid Firebase ID token"));
        }

        Cookie cookie = new Cookie("jwtToken", amarVoteJwtOpt.get());
        cookie.setHttpOnly(true);
        cookie.setSecure(cookieSecure);
        cookie.setPath("/");
        cookie.setMaxAge(getJwtCookieMaxAgeSeconds());
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);

        return ResponseEntity.ok(new OtpResponseDto(true, "Login successful"));
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            return null;
        }

        String token = authorizationHeader.substring(7).trim();
        return token.isEmpty() ? null : token;
    }

    private int getJwtCookieMaxAgeSeconds() {
        long maxAgeSeconds = Math.max(1, Duration.ofMillis(jwtExpirationMillis).getSeconds());
        return (int) Math.min(Integer.MAX_VALUE, maxAgeSeconds);
    }
}
