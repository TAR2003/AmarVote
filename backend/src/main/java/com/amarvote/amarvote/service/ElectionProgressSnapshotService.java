package com.amarvote.amarvote.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.DecryptionStatusResponse;
import com.amarvote.amarvote.dto.GuardianDecryptionProgressItem;

import lombok.RequiredArgsConstructor;

/**
 * Builds progress snapshots pushed over SSE so clients never need to poll status APIs.
 */
@Service
@RequiredArgsConstructor
public class ElectionProgressSnapshotService {

    private final TallyService tallyService;
    private final PartialDecryptionService partialDecryptionService;

    public Map<String, Object> buildFullSnapshot(Long electionId, String userEmail) {
        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("tally", tallyService.getTallyStatus(electionId));
        snapshot.put("combine", partialDecryptionService.getCombineStatus(electionId));
        snapshot.put("guardians", partialDecryptionService.getAllGuardiansDecryptionProgress(electionId));
        if (userEmail != null && !userEmail.isBlank()) {
            snapshot.put("myDecryption", partialDecryptionService.getDecryptionStatusByEmail(electionId, userEmail));
        }
        return snapshot;
    }

    /**
     * Minimal snapshot for a single operation — avoids querying unrelated status on every chunk.
     */
    public Map<String, Object> buildSnapshotForOperation(Long electionId, String operation, Long guardianId) {
        if (operation == null || operation.isBlank()) {
            return buildFullSnapshot(electionId, null);
        }

        Map<String, Object> snapshot = new LinkedHashMap<>();

        if ("TALLY".equals(operation)) {
            snapshot.put("tally", tallyService.getTallyStatus(electionId));
            return snapshot;
        }

        if ("COMBINE".equals(operation)) {
            snapshot.put("combine", partialDecryptionService.getCombineStatus(electionId));
            return snapshot;
        }

        if (operation.contains("DECRYPTION")) {
            List<GuardianDecryptionProgressItem> guardians =
                partialDecryptionService.getAllGuardiansDecryptionProgress(electionId);
            snapshot.put("guardians", guardians);
            if (guardianId != null) {
                DecryptionStatusResponse detail =
                    partialDecryptionService.getDecryptionStatus(electionId, guardianId);
                snapshot.put("decryptionDetail", detail);
            }
            return snapshot;
        }

        return buildFullSnapshot(electionId, null);
    }

    @SuppressWarnings("unchecked")
    public Long extractGuardianIdFromPayload(Map<String, Object> payload) {
        if (payload == null) {
            return null;
        }
        Object value = payload.get("guardianId");
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text);
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }
}
