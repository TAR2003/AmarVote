package com.amarvote.amarvote.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PermissionSettingsUpdateRequestDto {

    private Boolean registrationOpenToAll;
    private String electionCreationPermissionScope;
}