package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.dto.CodeValidationRequest;
import com.amarvote.amarvote.dto.VerificationCodeRequest;
import com.amarvote.amarvote.model.VerificationCode;
import com.amarvote.amarvote.service.EmailService;
import com.amarvote.amarvote.service.VerificationCodeService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/verify")
public class VerificationController {

    @Autowired
    private VerificationCodeService codeService;

    @Autowired
    private EmailService emailService;

   @PostMapping("/send-code")
    public ResponseEntity<String> sendVerificationCode(@RequestBody @Valid VerificationCodeRequest request) {
        VerificationCode verificationCode = codeService.createCodeForEmail(request.getEmail());
        emailService.sendVerificationEmail(request.getEmail(), verificationCode.getCode());
        return ResponseEntity.ok("Verification code sent to " + request.getEmail());
    }

    @PostMapping("/verify-code")
    public ResponseEntity<String> verifyCode(@RequestBody @Valid CodeValidationRequest request) {
        boolean isValid = codeService.validateCode(request.getCode());
        System.out.println("Verification code: " + request.getCode());
        if (isValid) {
            codeService.deleteCode(request.getCode());
            return ResponseEntity.ok("Verification successful");
        } else {
            return ResponseEntity.badRequest().body("Invalid or expired verification code");
        }
    }
}
