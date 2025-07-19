package com.amarvote.amarvote.model;

import java.io.Serializable;

import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class CompensatedDecryptionId implements Serializable {
    
    private Long electionId;
    private Integer compensatingGuardianSequence;
    private Integer missingGuardianSequence;
}
