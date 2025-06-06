package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public class CodeValidationRequest {
    @Email(message = "Please provide a valid email address")
    @NotBlank(message = "Email must not be blank")
    private String email;

    @NotBlank(message = "Verification code must not be blank")
    private String code;

    public CodeValidationRequest(String email, String code) {
        this.email = email;
        this.code = code;
    }

    // Getter and Setter
    public String getCode() {
        return code;
    }

    public String getEmail() {
        return email;
    }

}
