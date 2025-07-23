package com.amarvote.amarvote.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainRecordBallotRequest {
    private String election_id;
    private String tracking_code;
    private String ballot_hash;
}
