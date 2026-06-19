package com.amarvote.amarvote.controller;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amarvote.amarvote.service.ElectionProcessControlService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/elections/{electionId}/process")
@RequiredArgsConstructor
public class ElectionProcessControlController {

    private final ElectionProcessControlService processControlService;

    @PostMapping("/tally/stop")
    public ResponseEntity<Map<String, Object>> stopTally(@PathVariable Long electionId, Principal principal) {
        return ResponseEntity.ok(processControlService.stopTally(electionId, principal.getName()));
    }

    @DeleteMapping("/tally")
    public ResponseEntity<Map<String, Object>> deleteTally(@PathVariable Long electionId, Principal principal) {
        return ResponseEntity.ok(processControlService.deleteTallyResults(electionId, principal.getName()));
    }

    @PostMapping("/decryption/{guardianId}/stop")
    public ResponseEntity<Map<String, Object>> stopDecryption(
            @PathVariable Long electionId,
            @PathVariable Long guardianId,
            Principal principal) {
        return ResponseEntity.ok(processControlService.stopGuardianDecryption(electionId, guardianId, principal.getName()));
    }

    @DeleteMapping("/decryption/{guardianId}")
    public ResponseEntity<Map<String, Object>> deleteDecryption(
            @PathVariable Long electionId,
            @PathVariable Long guardianId,
            Principal principal) {
        return ResponseEntity.ok(processControlService.deleteGuardianDecryption(electionId, guardianId, principal.getName()));
    }

    @PostMapping("/combine/stop")
    public ResponseEntity<Map<String, Object>> stopCombine(@PathVariable Long electionId, Principal principal) {
        return ResponseEntity.ok(processControlService.stopCombine(electionId, principal.getName()));
    }

    @DeleteMapping("/combine")
    public ResponseEntity<Map<String, Object>> deleteCombine(@PathVariable Long electionId, Principal principal) {
        return ResponseEntity.ok(processControlService.deleteCombineResults(electionId, principal.getName()));
    }
}
