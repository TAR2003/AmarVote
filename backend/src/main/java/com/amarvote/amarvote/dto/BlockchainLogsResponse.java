package com.amarvote.amarvote.dto;

import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BlockchainLogsResponse {
    private boolean success;
    private String message;
    private BlockchainLogsResult result;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockchainLogsResult {
        private String election_id;
        private Integer log_count;
        private List<BlockchainLogEntry> logs;
    }
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockchainLogEntry {
        private String message;
        private Long timestamp;
        private String formatted_time;
    }
}
