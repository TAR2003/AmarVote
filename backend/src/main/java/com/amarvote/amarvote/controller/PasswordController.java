package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.VerificationCodeRequest;
import com.amarvote.amarvote.dto.CreateNewPasswordRequest;
import com.amarvote.amarvote.dto.ChangePasswordRequest;
import com.amarvote.amarvote.service.UserService;
import com.amarvote.amarvote.service.JWTService;
import com.amarvote.amarvote.service.VerificationCodeService;
import com.amarvote.amarvote.service.EmailService;

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

    @PostMapping("/forgot-password")
    public ResponseEntity<String> sendResetLink(@Valid @RequestBody VerificationCodeRequest request) {
        String email = request.getEmail();

        if (!userService.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User with this email doesn't exist");
        }

        //15 minutes validation for password reset token(for now on it's mock link for creating password)
        String token = jwtService.generatePasswordResetToken(email, 900000); // your JWT reset token
        String resetLink = "http://localhost:5173/create-password?token=" + token; // or your deployed frontend URL

        emailService.sendForgotPasswordEmail(email, resetLink); // modify your email service to send link

        return ResponseEntity.ok("Password reset link sent to your email");
    }

    @PostMapping("/create-password")
    public ResponseEntity<String> createPassword(@Valid @RequestBody CreateNewPasswordRequest request) {
        String token = request.getResetToken();
        String newPassword = request.getNewPassword();

        String email = jwtService.validatePasswordResetToken(token); // returns email if valid, else null

        if (email == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid or expired token");
        }

          //check if the user exists or not
        if (!userService.existsByEmail(email)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body("User with this email doesn't exist");
        }

        userService.updatePasswordByEmail(email, newPassword);
        return ResponseEntity.ok("Password reset successfully");
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
