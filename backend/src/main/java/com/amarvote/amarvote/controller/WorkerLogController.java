package com.amarvote.amarvote.controller;

import com.amarvote.amarvote.model.TallyWorkerLog;
import com.amarvote.amarvote.model.DecryptionWorkerLog;
import com.amarvote.amarvote.model.CombineWorkerLog;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.repository.TallyWorkerLogRepository;
import com.amarvote.amarvote.repository.DecryptionWorkerLogRepository;
import com.amarvote.amarvote.repository.CombineWorkerLogRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/worker-logs")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class WorkerLogController {

    private final TallyWorkerLogRepository tallyWorkerLogRepository;
    private final DecryptionWorkerLogRepository decryptionWorkerLogRepository;
    private final CombineWorkerLogRepository combineWorkerLogRepository;
    private final ElectionJobRepository electionJobRepository;

    /**
     * Get tally worker logs with statistics for an election
     */
    @GetMapping("/tally/{electionId}")
    public ResponseEntity<Map<String, Object>> getTallyWorkerLogs(@PathVariable Long electionId) {
        List<TallyWorkerLog> logs = tallyWorkerLogRepository.findByElectionIdOrderByStartTimeAsc(electionId);

        String initiatorEmail = electionJobRepository
            .findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(electionId, "TALLY")
            .map(ElectionJob::getCreatedBy)
            .orElse(null);

        Map<String, Object> stats = new HashMap<>(calculateStatistics(logs));
        stats.put("initiatorEmail", initiatorEmail);

        Map<String, Object> response = new HashMap<>();
        response.put("logs", logs.stream().map(this::mapTallyLog).collect(Collectors.toList()));
        response.put("statistics", stats);
        
        return ResponseEntity.ok(response);
    }

    /**
     * Get partial decryption worker logs with statistics for an election
     */
    @GetMapping("/decryption/partial/{electionId}")
    public ResponseEntity<Map<String, Object>> getPartialDecryptionWorkerLogs(@PathVariable Long electionId) {
        List<DecryptionWorkerLog> logs = decryptionWorkerLogRepository
            .findByElectionIdAndDecryptionTypeOrderByStartTimeAsc(electionId, "PARTIAL");
        
        Map<String, Object> response = new HashMap<>();
        response.put("logs", logs.stream().map(this::mapDecryptionLog).collect(Collectors.toList()));
        response.put("statistics", calculateDecryptionStatistics(logs));
        
        return ResponseEntity.ok(response);
    }

    /**
     * Get compensated decryption worker logs with statistics for an election
     */
    @GetMapping("/decryption/compensated/{electionId}")
    public ResponseEntity<Map<String, Object>> getCompensatedDecryptionWorkerLogs(@PathVariable Long electionId) {
        List<DecryptionWorkerLog> logs = decryptionWorkerLogRepository
            .findByElectionIdAndDecryptionTypeOrderByStartTimeAsc(electionId, "COMPENSATED");
        
        Map<String, Object> response = new HashMap<>();
        response.put("logs", logs.stream().map(this::mapDecryptionLog).collect(Collectors.toList()));
        response.put("statistics", calculateDecryptionStatistics(logs));
        
        return ResponseEntity.ok(response);
    }

    /**
     * Get combine worker logs with statistics for an election
     */
    @GetMapping("/combine/{electionId}")
    public ResponseEntity<Map<String, Object>> getCombineWorkerLogs(@PathVariable Long electionId) {
        List<CombineWorkerLog> logs = combineWorkerLogRepository.findByElectionIdOrderByStartTimeAsc(electionId);

        String initiatorEmail = electionJobRepository
            .findFirstByElectionIdAndOperationTypeOrderByStartedAtDesc(electionId, "COMBINE")
            .map(ElectionJob::getCreatedBy)
            .orElse(null);

        Map<String, Object> stats = new HashMap<>(calculateCombineStatistics(logs));
        stats.put("initiatorEmail", initiatorEmail);

        Map<String, Object> response = new HashMap<>();
        response.put("logs", logs.stream().map(this::mapCombineLog).collect(Collectors.toList()));
        response.put("statistics", stats);
        
        return ResponseEntity.ok(response);
    }

    /**
     * Get all worker logs summary for an election
     */
    @GetMapping("/summary/{electionId}")
    public ResponseEntity<Map<String, Object>> getWorkerLogsSummary(@PathVariable Long electionId) {
        Map<String, Object> summary = new HashMap<>();
        
        // Tally logs
        List<TallyWorkerLog> tallyLogs = tallyWorkerLogRepository.findByElectionIdOrderByStartTimeAsc(electionId);
        summary.put("tally", Map.of(
            "count", tallyLogs.size(),
            "completed", tallyLogs.stream().filter(l -> "COMPLETED".equals(l.getStatus())).count(),
            "failed", tallyLogs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "statistics", calculateStatistics(tallyLogs)
        ));
        
        // Partial decryption logs
        List<DecryptionWorkerLog> partialLogs = decryptionWorkerLogRepository
            .findByElectionIdAndDecryptionTypeOrderByStartTimeAsc(electionId, "PARTIAL");
        summary.put("partial_decryption", Map.of(
            "count", partialLogs.size(),
            "completed", partialLogs.stream().filter(l -> "COMPLETED".equals(l.getStatus())).count(),
            "failed", partialLogs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "statistics", calculateDecryptionStatistics(partialLogs)
        ));
        
        // Compensated decryption logs
        List<DecryptionWorkerLog> compensatedLogs = decryptionWorkerLogRepository
            .findByElectionIdAndDecryptionTypeOrderByStartTimeAsc(electionId, "COMPENSATED");
        summary.put("compensated_decryption", Map.of(
            "count", compensatedLogs.size(),
            "completed", compensatedLogs.stream().filter(l -> "COMPLETED".equals(l.getStatus())).count(),
            "failed", compensatedLogs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "statistics", calculateDecryptionStatistics(compensatedLogs)
        ));
        
        // Combine logs
        List<CombineWorkerLog> combineLogs = combineWorkerLogRepository.findByElectionIdOrderByStartTimeAsc(electionId);
        summary.put("combine", Map.of(
            "count", combineLogs.size(),
            "completed", combineLogs.stream().filter(l -> "COMPLETED".equals(l.getStatus())).count(),
            "failed", combineLogs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "statistics", calculateCombineStatistics(combineLogs)
        ));
        
        return ResponseEntity.ok(summary);
    }

    // Helper methods to map entities to DTOs
    private Map<String, Object> mapTallyLog(TallyWorkerLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", log.getTallyWorkerLogId());
        map.put("electionId", log.getElectionId());
        map.put("electionCenterId", log.getElectionCenterId());
        map.put("chunkNumber", log.getChunkNumber());
        map.put("startTime", log.getStartTime());
        map.put("endTime", log.getEndTime());
        map.put("status", log.getStatus());
        map.put("errorMessage", log.getErrorMessage());
        map.put("duration", calculateDuration(log.getStartTime(), log.getEndTime()));
        return map;
    }

    private Map<String, Object> mapDecryptionLog(DecryptionWorkerLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", log.getDecryptionWorkerLogId());
        map.put("electionId", log.getElectionId());
        map.put("electionCenterId", log.getElectionCenterId());
        map.put("guardianId", log.getGuardianId());
        map.put("decryptingGuardianId", log.getDecryptingGuardianId());
        map.put("decryptionType", log.getDecryptionType());
        map.put("chunkNumber", log.getChunkNumber());
        map.put("startTime", log.getStartTime());
        map.put("endTime", log.getEndTime());
        map.put("status", log.getStatus());
        map.put("errorMessage", log.getErrorMessage());
        map.put("duration", calculateDuration(log.getStartTime(), log.getEndTime()));
        return map;
    }

    private Map<String, Object> mapCombineLog(CombineWorkerLog log) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", log.getCombineWorkerLogId());
        map.put("electionId", log.getElectionId());
        map.put("electionCenterId", log.getElectionCenterId());
        map.put("chunkNumber", log.getChunkNumber());
        map.put("startTime", log.getStartTime());
        map.put("endTime", log.getEndTime());
        map.put("status", log.getStatus());
        map.put("errorMessage", log.getErrorMessage());
        map.put("duration", calculateDuration(log.getStartTime(), log.getEndTime()));
        return map;
    }

    private Long calculateDuration(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) return null;
        return Duration.between(start, end).toMillis();
    }

    // Statistics calculation methods
    private Map<String, Object> calculateStatistics(List<TallyWorkerLog> logs) {
        List<TallyWorkerLog> completedLogs = logs.stream()
            .filter(l -> "COMPLETED".equals(l.getStatus()) && l.getEndTime() != null)
            .collect(Collectors.toList());
        
        if (completedLogs.isEmpty()) {
            return Map.of(
                "totalProcessingTime", 0,
                "averageProcessingTime", 0,
                "totalElapsedTime", 0,
                "completedCount", 0,
                "failedCount", logs.stream().filter(l -> "FAILED".equals(l.getStatus())).count()
            );
        }
        
        long totalProcessingTime = completedLogs.stream()
            .mapToLong(l -> Duration.between(l.getStartTime(), l.getEndTime()).toMillis())
            .sum();
        
        double averageProcessingTime = totalProcessingTime / (double) completedLogs.size();
        
        LocalDateTime firstStart = completedLogs.stream()
            .map(TallyWorkerLog::getStartTime)
            .min(LocalDateTime::compareTo)
            .orElse(null);
        
        LocalDateTime lastEnd = completedLogs.stream()
            .map(TallyWorkerLog::getEndTime)
            .max(LocalDateTime::compareTo)
            .orElse(null);
        
        long totalElapsedTime = (firstStart != null && lastEnd != null) 
            ? Duration.between(firstStart, lastEnd).toMillis() 
            : 0;
        
        return Map.of(
            "totalProcessingTime", totalProcessingTime,
            "averageProcessingTime", averageProcessingTime,
            "totalElapsedTime", totalElapsedTime,
            "completedCount", completedLogs.size(),
            "failedCount", logs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "firstStartTime", firstStart,
            "lastEndTime", lastEnd
        );
    }

    private Map<String, Object> calculateDecryptionStatistics(List<DecryptionWorkerLog> logs) {
        List<DecryptionWorkerLog> completedLogs = logs.stream()
            .filter(l -> "COMPLETED".equals(l.getStatus()) && l.getEndTime() != null)
            .collect(Collectors.toList());
        
        if (completedLogs.isEmpty()) {
            return Map.of(
                "totalProcessingTime", 0,
                "averageProcessingTime", 0,
                "totalElapsedTime", 0,
                "completedCount", 0,
                "failedCount", logs.stream().filter(l -> "FAILED".equals(l.getStatus())).count()
            );
        }
        
        long totalProcessingTime = completedLogs.stream()
            .mapToLong(l -> Duration.between(l.getStartTime(), l.getEndTime()).toMillis())
            .sum();
        
        double averageProcessingTime = totalProcessingTime / (double) completedLogs.size();
        
        LocalDateTime firstStart = completedLogs.stream()
            .map(DecryptionWorkerLog::getStartTime)
            .min(LocalDateTime::compareTo)
            .orElse(null);
        
        LocalDateTime lastEnd = completedLogs.stream()
            .map(DecryptionWorkerLog::getEndTime)
            .max(LocalDateTime::compareTo)
            .orElse(null);
        
        long totalElapsedTime = (firstStart != null && lastEnd != null) 
            ? Duration.between(firstStart, lastEnd).toMillis() 
            : 0;
        
        return Map.of(
            "totalProcessingTime", totalProcessingTime,
            "averageProcessingTime", averageProcessingTime,
            "totalElapsedTime", totalElapsedTime,
            "completedCount", completedLogs.size(),
            "failedCount", logs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "firstStartTime", firstStart,
            "lastEndTime", lastEnd
        );
    }

    private Map<String, Object> calculateCombineStatistics(List<CombineWorkerLog> logs) {
        List<CombineWorkerLog> completedLogs = logs.stream()
            .filter(l -> "COMPLETED".equals(l.getStatus()) && l.getEndTime() != null)
            .collect(Collectors.toList());
        
        if (completedLogs.isEmpty()) {
            return Map.of(
                "totalProcessingTime", 0,
                "averageProcessingTime", 0,
                "totalElapsedTime", 0,
                "completedCount", 0,
                "failedCount", logs.stream().filter(l -> "FAILED".equals(l.getStatus())).count()
            );
        }
        
        long totalProcessingTime = completedLogs.stream()
            .mapToLong(l -> Duration.between(l.getStartTime(), l.getEndTime()).toMillis())
            .sum();
        
        double averageProcessingTime = totalProcessingTime / (double) completedLogs.size();
        
        LocalDateTime firstStart = completedLogs.stream()
            .map(CombineWorkerLog::getStartTime)
            .min(LocalDateTime::compareTo)
            .orElse(null);
        
        LocalDateTime lastEnd = completedLogs.stream()
            .map(CombineWorkerLog::getEndTime)
            .max(LocalDateTime::compareTo)
            .orElse(null);
        
        long totalElapsedTime = (firstStart != null && lastEnd != null) 
            ? Duration.between(firstStart, lastEnd).toMillis() 
            : 0;
        
        return Map.of(
            "totalProcessingTime", totalProcessingTime,
            "averageProcessingTime", averageProcessingTime,
            "totalElapsedTime", totalElapsedTime,
            "completedCount", completedLogs.size(),
            "failedCount", logs.stream().filter(l -> "FAILED".equals(l.getStatus())).count(),
            "firstStartTime", firstStart,
            "lastEndTime", lastEnd
        );
    }
}
