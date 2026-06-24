package com.amarvote.amarvote.dto;

import java.time.LocalDateTime;

import com.amarvote.amarvote.model.ApiLog;

import lombok.Builder;
import lombok.Data;

@Data
@Builder(toBuilder = true)
public class ApiLogViewResponse {

    private Long logId;
    private String requestMethod;
    private String requestPath;
    private String requestIp;
    private String extractedEmail;
    private Integer responseStatus;
    private LocalDateTime requestTime;
    private Long responseTime;
    private Long clusterCount;
    private LocalDateTime clusterStart;
    private LocalDateTime clusterEnd;
    private Boolean isCluster;

    public static ApiLogViewResponse from(ApiLog log) {
        return ApiLogViewResponse.builder()
                .logId(log.getLogId())
                .requestMethod(log.getRequestMethod())
                .requestPath(log.getRequestPath())
                .requestIp(log.getRequestIp())
                .extractedEmail(log.getExtractedEmail())
                .responseStatus(log.getResponseStatus())
                .requestTime(log.getRequestTime())
                .responseTime(log.getResponseTime())
                .build();
    }
}
