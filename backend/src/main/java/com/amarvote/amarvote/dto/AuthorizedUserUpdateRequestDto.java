package com.amarvote.amarvote.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthorizedUserUpdateRequestDto {

    @Email(message = "Invalid email format")
    private String email;

    @Pattern(regexp = "^(user|admin|owner)$", message = "userType must be one of: user, admin, owner")
    private String userType;

    private Boolean canCreateElections;

    private Boolean apiLogViewerAllowed;
}