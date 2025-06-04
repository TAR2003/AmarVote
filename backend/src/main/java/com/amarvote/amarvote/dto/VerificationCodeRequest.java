package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class VerificationCodeRequest {

    @NotBlank(message = "Email must not be blank")
    @Email(message = "Please provide a valid email address")
    private String email;

    // Getter and Setter
    public String getEmail() {
        return email;
    }
}
