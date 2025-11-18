package com.amarvote.blockchain.service;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class BlockchainService {

    @Value("${blockchain.api.url:http://blockchain-api:3000}")
    private String blockchainApiUrl;

    private final RestTemplate restTemplate;

    public BlockchainService() {
        this.restTemplate = new RestTemplate();
    }

    public Map<String, Object> logElectionCreated(String electionId, String electionName, 
                                                   String organizerName, String startDate, String endDate) {
        String url = blockchainApiUrl + "/api/blockchain/log/election-created";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("electionName", electionName);
        request.put("organizerName", organizerName);
        request.put("startDate", startDate);
        request.put("endDate", endDate);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logBallotReceived(String electionId, String trackingCode, 
                                                  String ballotHash, String voterId) {
        String url = blockchainApiUrl + "/api/blockchain/log/ballot-received";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("trackingCode", trackingCode);
        request.put("ballotHash", ballotHash);
        request.put("voterId", voterId);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logElectionEnded(String electionId, Integer totalVotes, String endedBy) {
        String url = blockchainApiUrl + "/api/blockchain/log/election-ended";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("totalVotes", totalVotes);
        request.put("endedBy", endedBy);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logElectionStarted(String electionId, String startedBy) {
        String url = blockchainApiUrl + "/api/blockchain/log/election-started";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("startedBy", startedBy);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logBallotAudited(String electionId, String trackingCode, String ballotHash) {
        String url = blockchainApiUrl + "/api/blockchain/log/ballot-audited";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("trackingCode", trackingCode);
        request.put("ballotHash", ballotHash);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logEncryptedBallotCreated(String electionId, String trackingCode, 
                                                         String ballotHash, String voterEmail) {
        String url = blockchainApiUrl + "/api/blockchain/log/encrypted-ballot-created";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("trackingCode", trackingCode);
        request.put("ballotHash", ballotHash);
        request.put("voterEmail", voterEmail);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logBenalohChallenge(String electionId, String trackingCode, 
                                                    String ballotHash, String voterEmail, 
                                                    boolean challengeSucceeded) {
        String url = blockchainApiUrl + "/api/blockchain/log/benaloh-challenge";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("trackingCode", trackingCode);
        request.put("ballotHash", ballotHash);
        request.put("voterEmail", voterEmail);
        request.put("challengeSucceeded", challengeSucceeded);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logGuardianKeySubmitted(String electionId, String guardianEmail, 
                                                       String guardianId, String publicKeyHash) {
        String url = blockchainApiUrl + "/api/blockchain/log/guardian-key-submitted";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("guardianEmail", guardianEmail);
        request.put("guardianId", guardianId);
        request.put("publicKeyHash", publicKeyHash);

        return makePostRequest(url, request);
    }

    public Map<String, Object> logBallotCast(String electionId, String trackingCode, 
                                            String ballotHash, String voterEmail) {
        String url = blockchainApiUrl + "/api/blockchain/log/ballot-cast";
        
        Map<String, Object> request = new HashMap<>();
        request.put("electionId", electionId);
        request.put("trackingCode", trackingCode);
        request.put("ballotHash", ballotHash);
        request.put("voterEmail", voterEmail);

        return makePostRequest(url, request);
    }

    public Map<String, Object> getElectionLogs(String electionId) {
        String url = blockchainApiUrl + "/api/blockchain/logs/" + electionId;
        return makeGetRequest(url);
    }

    public Map<String, Object> queryLogsByType(String electionId, String logType) {
        String url = blockchainApiUrl + "/api/blockchain/logs/" + electionId + "/" + logType;
        return makeGetRequest(url);
    }

    public Map<String, Object> getAllLogs() {
        String url = blockchainApiUrl + "/api/blockchain/logs";
        return makeGetRequest(url);
    }

    private Map<String, Object> makePostRequest(String url, Map<String, Object> request) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            return response.getBody();
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Failed to communicate with blockchain API: " + e.getMessage());
            return error;
        }
    }

    private Map<String, Object> makeGetRequest(String url) {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(url, Map.class);
            return response.getBody();
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", "Failed to communicate with blockchain API: " + e.getMessage());
            return error;
        }
    }
}
