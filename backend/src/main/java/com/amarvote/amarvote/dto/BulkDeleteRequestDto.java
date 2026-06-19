package com.amarvote.amarvote.dto;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

@Data
public class BulkDeleteRequestDto {

    @NotEmpty
    private List<Long> ids;
}
