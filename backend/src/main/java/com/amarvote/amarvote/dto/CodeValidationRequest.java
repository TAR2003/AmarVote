package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.NotBlank;

public class CodeValidationRequest {
     @NotBlank(message = "Verification code must not be blank")
    private String code;

    // Getter and Setter
    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }
}
