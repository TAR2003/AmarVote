package com.amarvote.blockchain.controller;

import java.util.HashMap;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.blockchain.service.BlockchainService;

@RestController
@RequestMapping("/api/blockchain")
@CrossOrigin(origins = "*")
public class BlockchainController {

    @Autowired
    private BlockchainService blockchainService;

    @GetMapping("/health")
    public ResponseEntity<?> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "healthy");
        response.put("service", "blockchain-controller");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/log/election-created")
    public ResponseEntity<?> logElectionCreated(@RequestBody Map<String, Object> request) {
        try {
            String electionId = (String) request.get("electionId");
            String electionName = (String) request.get("electionName");
            String organizerName = (String) request.get("organizerName");
            String startDate = (String) request.get("startDate");
            String endDate = (String) request.get("endDate");

            Map<String, Object> result = blockchainService.logElectionCreated(
                electionId, electionName, organizerName, startDate, endDate
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/log/ballot-received")
    public ResponseEntity<?> logBallotReceived(@RequestBody Map<String, Object> request) {
        try {
            String electionId = (String) request.get("electionId");
            String trackingCode = (String) request.get("trackingCode");
            String ballotHash = (String) request.get("ballotHash");
            String voterId = (String) request.getOrDefault("voterId", "anonymous");

            Map<String, Object> result = blockchainService.logBallotReceived(
                electionId, trackingCode, ballotHash, voterId
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/log/election-ended")
    public ResponseEntity<?> logElectionEnded(@RequestBody Map<String, Object> request) {
        try {
            String electionId = (String) request.get("electionId");
            Integer totalVotes = (Integer) request.get("totalVotes");
            String endedBy = (String) request.get("endedBy");

            Map<String, Object> result = blockchainService.logElectionEnded(
                electionId, totalVotes, endedBy
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/log/election-started")
    public ResponseEntity<?> logElectionStarted(@RequestBody Map<String, Object> request) {
        try {
            String electionId = (String) request.get("electionId");
            String startedBy = (String) request.get("startedBy");

            Map<String, Object> result = blockchainService.logElectionStarted(
                electionId, startedBy
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @PostMapping("/log/ballot-audited")
    public ResponseEntity<?> logBallotAudited(@RequestBody Map<String, Object> request) {
        try {
            String electionId = (String) request.get("electionId");
            String trackingCode = (String) request.get("trackingCode");
            String ballotHash = (String) request.get("ballotHash");

            Map<String, Object> result = blockchainService.logBallotAudited(
                electionId, trackingCode, ballotHash
            );

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/logs/{electionId}")
    public ResponseEntity<?> getElectionLogs(@PathVariable String electionId) {
        try {
            Map<String, Object> result = blockchainService.getElectionLogs(electionId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/logs/{electionId}/{logType}")
    public ResponseEntity<?> queryLogsByType(
        @PathVariable String electionId,
        @PathVariable String logType
    ) {
        try {
            Map<String, Object> result = blockchainService.queryLogsByType(electionId, logType);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }

    @GetMapping("/logs")
    public ResponseEntity<?> getAllLogs() {
        try {
            Map<String, Object> result = blockchainService.getAllLogs();
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("success", false);
            error.put("error", e.getMessage());
            return ResponseEntity.status(500).body(error);
        }
    }
}
