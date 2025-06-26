package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.ChangePasswordRequest;
import com.amarvote.amarvote.dto.CreateNewPasswordRequest;
import com.amarvote.amarvote.dto.PasswordResetRequest;
import com.amarvote.amarvote.dto.TokenValidationResult;
import com.amarvote.amarvote.dto.VerificationCodeRequest;
import com.amarvote.amarvote.model.PasswordResetToken;
import com.amarvote.amarvote.service.EmailService;
import com.amarvote.amarvote.service.JWTService;
import com.amarvote.amarvote.service.UserService;
import com.amarvote.amarvote.service.VerificationCodeService;
import com.amarvote.amarvote.service.PasswordResetTokenService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/password")
public class PasswordController {

    @Autowired
    private UserService userService;

    @Autowired
    private VerificationCodeService verificationCodeService;

    @Autowired
    private JWTService jwtService; // Assuming you have a JwtService to generate JWT tokens

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordResetTokenService tokenService; // Assuming you have a service to manage password reset tokens

    @PostMapping("/forgot-password")
    public ResponseEntity<String> sendResetLink(@Valid @RequestBody PasswordResetRequest request) {
        String email = request.getEmail();

        if (!userService.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found.");
        }

        String token = jwtService.generatePasswordResetToken(email, 900_000); // 15 mins
        tokenService.createToken(email, token, 900_000);

        String resetLink = "https://www.amarvote2025.me/create-password?token=" + token;
        emailService.sendForgotPasswordEmail(email, resetLink);

        return ResponseEntity.ok("Reset link sent to email.");
    }

    @PostMapping("/create-password")
    public ResponseEntity<String> createPassword(@Valid @RequestBody CreateNewPasswordRequest request) {
        String token = request.getResetToken();
        String newPassword = request.getNewPassword();

        TokenValidationResult result = tokenService.validateToken(token);

        if (!result.isValid()) {
            return switch (result.getReason()) {
                case "not_found" ->
                    ResponseEntity.status(HttpStatus.NOT_FOUND).body("Reset token not found.");
                case "used" ->
                    ResponseEntity.status(HttpStatus.CONFLICT).body("This reset link has already been used.");
                case "expired" ->
                    ResponseEntity.status(HttpStatus.GONE).body("This reset link has expired.");
                default ->
                    ResponseEntity.badRequest().body("Invalid token.");
            };
        }

        PasswordResetToken validToken = result.getToken();
        String email = validToken.getEmail();

        if (!userService.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User not found.");
        }

        userService.updatePasswordByEmail(email, newPassword);
        tokenService.markTokenAsUsed(validToken);

        return ResponseEntity.ok("Password successfully reset.");
    }

    @PostMapping("/change-password")
    public ResponseEntity<String> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        String oldPassword = request.getOldPassword();
        String newPassword = request.getNewPassword();
        String email = request.getEmail();

        //at first check if the user exists
        if (!userService.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User with this email doesn't exist");
        }

        //check if the new password is different from the old password
        if (oldPassword.equals(newPassword)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("New password must be different from old password");
        }

        //check if the old password is correct for the given email
        if (!userService.checkPassword(email, oldPassword)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Old password is incorrect");
        }

        userService.updatePasswordByEmail(email, newPassword); // You'll implement this
        return ResponseEntity.ok("Password reset successfully");
    }

}
