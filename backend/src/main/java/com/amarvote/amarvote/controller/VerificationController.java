package com.amarvote.amarvote.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
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
        //delete any existing verification codes for the email before creating a new one
        codeService.deleteCodesByEmail(request.getEmail());
        
        VerificationCode verificationCode = codeService.createCodeForEmail(request.getEmail());
        emailService.sendSignupVerificationEmail(request.getEmail(), verificationCode.getCode());
        return ResponseEntity.ok("Verification code sent to " + request.getEmail());
    }

    @PostMapping("/verify-code")
    public ResponseEntity<String> verifyResetCode(@Valid @RequestBody CodeValidationRequest request) {
        String email = request.getEmail();
        String code = request.getCode();

        if (codeService.validateCodeForEmail(email, code)) {
            codeService.deleteCode(code);
            return ResponseEntity.ok("Code is valid");
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("Invalid or expired code");
        }
    }
}
