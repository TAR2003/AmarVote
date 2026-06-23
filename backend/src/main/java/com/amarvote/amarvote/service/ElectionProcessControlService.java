package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCenter;
import com.amarvote.amarvote.model.ElectionJob;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.ProcessOperationType;
import com.amarvote.amarvote.model.scheduler.TaskType;
import com.amarvote.amarvote.repository.CombineWorkerLogRepository;
import com.amarvote.amarvote.repository.CompensatedDecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionRepository;
import com.amarvote.amarvote.repository.DecryptionWorkerLogRepository;
import com.amarvote.amarvote.repository.ElectionCenterRepository;
import com.amarvote.amarvote.repository.ElectionJobRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.SubmittedBallotRepository;
import com.amarvote.amarvote.repository.TallyWorkerLogRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class ElectionProcessControlService {

    private final ElectionRepository electionRepository;
    private final ElectionService electionService;
    private final GuardianRepository guardianRepository;
    private final ElectionCenterRepository electionCenterRepository;
    private final DecryptionRepository decryptionRepository;
    private final CompensatedDecryptionRepository compensatedDecryptionRepository;
    private final TallyWorkerLogRepository tallyWorkerLogRepository;
    private final SubmittedBallotRepository submittedBallotRepository;
    private final DecryptionWorkerLogRepository decryptionWorkerLogRepository;
    private final CombineWorkerLogRepository combineWorkerLogRepository;
    private final ElectionJobRepository electionJobRepository;
    private final RoundRobinTaskScheduler taskScheduler;
    private final ProcessCancellationService cancellationService;
    private final ElectionProgressStreamService progressStreamService;
    private final RedisLockService redisLockService;

    public void requireProcessControlAccess(Long electionId, String userEmail, Long guardianIdForGuardianOnly) {
        Election election = electionRepository.findById(electionId)
            .orElseThrow(() -> new IllegalArgumentException("Election not found"));

        if (!electionService.isElectionAdmin(election, userEmail)) {
            throw new IllegalArgumentException("Only the election admin or co-admins can control this process");
        }
    }

    @Transactional
    public Map<String, Object> stopTally(Long electionId, String userEmail) {
        requireProcessControlAccess(electionId, userEmail, null);
        cancellationService.requestStop(electionId, ProcessOperationType.TALLY, null);
        taskScheduler.cancelTasks(TaskType.TALLY_CREATION, electionId, null, null, null);
        markActiveJobsCancelled(electionId, "TALLY");
        publishControlEvent(electionId, "TALLY", "stopped");
        log.info("Tally process stop requested for election {}", electionId);
        return Map.of("success", true, "message", "Tally creation stop requested");
    }

    @Transactional
    public Map<String, Object> stopGuardianDecryption(Long electionId, Long guardianId, String userEmail) {
        requireProcessControlAccess(electionId, userEmail, guardianId);
        cancellationService.requestStop(electionId, ProcessOperationType.PARTIAL_DECRYPTION, guardianId);
        cancellationService.requestStop(electionId, ProcessOperationType.COMPENSATED_DECRYPTION, guardianId);
        taskScheduler.cancelTasks(TaskType.PARTIAL_DECRYPTION, electionId, guardianId, null, null);
        taskScheduler.cancelTasks(TaskType.COMPENSATED_DECRYPTION, electionId, null, guardianId, null);
        markActiveJobsCancelled(electionId, "DECRYPTION_" + guardianId);
        redisLockService.releaseLock("decryption:" + electionId + ":" + guardianId);
        publishControlEvent(electionId, "DECRYPTION", "stopped", guardianId);
        return Map.of("success", true, "message", "Guardian decryption stop requested");
    }

    @Transactional
    public Map<String, Object> stopCombine(Long electionId, String userEmail) {
        requireProcessControlAccess(electionId, userEmail, null);
        cancellationService.requestStop(electionId, ProcessOperationType.COMBINE, null);
        taskScheduler.cancelTasks(TaskType.COMBINE_DECRYPTION, electionId, null, null, null);
        markActiveJobsCancelled(electionId, "COMBINE");
        publishControlEvent(electionId, "COMBINE", "stopped");
        return Map.of("success", true, "message", "Combine process stop requested");
    }

    @Transactional
    public Map<String, Object> deleteTallyResults(Long electionId, String userEmail) {
        requireProcessControlAccess(electionId, userEmail, null);
        stopTally(electionId, userEmail);

        taskScheduler.removeTasks(
            TaskType.TALLY_CREATION,
            electionId,
            null,
            null,
            null
        );
        cancellationService.clearStop(electionId, ProcessOperationType.TALLY, null);
        redisLockService.releaseLock(RedisLockService.buildTallyLockKey(electionId));

        // Tally worker logs span the whole election; clear them even for centers we keep.
        tallyWorkerLogRepository.deleteByElectionId(electionId);

        List<ElectionCenter> centers = electionCenterRepository.findByElectionId(electionId);
        for (ElectionCenter center : centers) {
            Long centerId = center.getElectionCenterId();

            // Do not delete centers that already hold decryption/combine data — CASCADE would
            // wipe guardian decryption shares too, not just the tally.
            boolean hasDownstreamData =
                !decryptionRepository.findByElectionCenterId(centerId).isEmpty()
                || !compensatedDecryptionRepository.findByElectionCenterId(centerId).isEmpty()
                || (center.getElectionResult() != null && !center.getElectionResult().isBlank())
                || combineWorkerLogRepository.countByElectionCenterId(centerId) > 0;

            if (hasDownstreamData) {
                // Center row stays; CASCADE won't run, so clear tally-owned rows manually.
                submittedBallotRepository.deleteByElectionCenterId(centerId);
                center.setEncryptedTally(null);
                electionCenterRepository.save(center);
            } else {
                // DB CASCADE removes submitted_ballots, tally_worker_log, etc.
                electionCenterRepository.delete(center);
            }
        }

        publishControlEvent(electionId, "TALLY", "deleted");
        log.info("Tally data removed for election {} ({} center(s) processed)", electionId, centers.size());
        return Map.of("success", true, "message", "All tally data removed for this election");
    }

    @Transactional
    public Map<String, Object> deleteGuardianDecryption(Long electionId, Long guardianId, String userEmail) {
        requireProcessControlAccess(electionId, userEmail, guardianId);
        stopGuardianDecryption(electionId, guardianId, userEmail);

        List<Long> centerIds = electionCenterRepository.findElectionCenterIdsByElectionId(electionId);
        for (Long centerId : centerIds) {
            decryptionRepository.findByElectionCenterIdAndGuardianId(centerId, guardianId)
                .forEach(decryptionRepository::delete);
            compensatedDecryptionRepository.findByElectionCenterId(centerId).stream()
                .filter(cd -> cd.getCompensatingGuardianId().equals(guardianId)
                    || cd.getMissingGuardianId().equals(guardianId))
                .forEach(compensatedDecryptionRepository::delete);
        }

        decryptionWorkerLogRepository.deleteByElectionIdAndDecryptingGuardianId(electionId, guardianId);
        taskScheduler.removeTasks(
            com.amarvote.amarvote.model.scheduler.TaskType.PARTIAL_DECRYPTION,
            electionId,
            guardianId,
            null,
            null
        );
        taskScheduler.removeTasks(
            com.amarvote.amarvote.model.scheduler.TaskType.COMPENSATED_DECRYPTION,
            electionId,
            null,
            guardianId,
            null
        );
        guardianRepository.findById(guardianId).ifPresent(g -> {
            g.setDecryptedOrNot(false);
            guardianRepository.save(g);
        });

        cancellationService.clearStop(electionId, ProcessOperationType.PARTIAL_DECRYPTION, guardianId);
        cancellationService.clearStop(electionId, ProcessOperationType.COMPENSATED_DECRYPTION, guardianId);
        publishControlEvent(electionId, "DECRYPTION", "deleted", guardianId);
        return Map.of("success", true, "message", "Guardian decryption data removed");
    }

    @Transactional
    public Map<String, Object> deleteCombineResults(Long electionId, String userEmail) {
        requireProcessControlAccess(electionId, userEmail, null);
        stopCombine(electionId, userEmail);

        List<ElectionCenter> centers = electionCenterRepository.findByElectionId(electionId);
        for (ElectionCenter center : centers) {
            center.setElectionResult(null);
        }
        electionCenterRepository.saveAll(centers);
        combineWorkerLogRepository.deleteByElectionId(electionId);
        taskScheduler.removeTasks(
            com.amarvote.amarvote.model.scheduler.TaskType.COMBINE_DECRYPTION,
            electionId,
            null,
            null,
            null
        );
        cancellationService.clearStop(electionId, ProcessOperationType.COMBINE, null);
        publishControlEvent(electionId, "COMBINE", "deleted");
        return Map.of("success", true, "message", "All combined decryption results removed");
    }

    private void markActiveJobsCancelled(Long electionId, String operationPrefix) {
        electionJobRepository.findByElectionIdOrderByStartedAtDesc(electionId).stream()
            .filter(job -> job.getStatus() != null
                && (job.getStatus().equals("QUEUED") || job.getStatus().equals("IN_PROGRESS"))
                && job.getOperationType() != null
                && job.getOperationType().startsWith(operationPrefix))
            .forEach(job -> {
                job.setStatus("CANCELLED");
                job.setCompletedAt(Instant.now());
                electionJobRepository.save(job);
            });
    }

    private void publishControlEvent(Long electionId, String operation, String status) {
        publishControlEvent(electionId, operation, status, null);
    }

    private void publishControlEvent(Long electionId, String operation, String status, Long guardianId) {
        progressStreamService.publishProgress(electionId, operation, status, Map.of(
            "guardianId", guardianId != null ? guardianId : "",
            "jobId", UUID.randomUUID().toString()
        ));
    }
}
