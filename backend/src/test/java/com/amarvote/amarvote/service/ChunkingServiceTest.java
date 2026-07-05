package com.amarvote.amarvote.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import com.amarvote.amarvote.dto.ChunkConfiguration;

class ChunkingServiceTest {

    private ChunkingService chunkingService;

    @BeforeEach
    void setUp() {
        chunkingService = new ChunkingService();
        ReflectionTestUtils.setField(chunkingService, "CHUNK_SIZE", 3);
    }

    @Test
    void assignIdsToChunks_isDeterministicForSameElection() {
        List<Long> ballotIds = List.of(10L, 20L, 30L, 40L, 50L, 60L, 70L);
        ChunkConfiguration config = chunkingService.calculateChunks(ballotIds.size());
        Long electionId = 99L;

        Map<Integer, List<Long>> first = chunkingService.assignIdsToChunks(ballotIds, config, electionId);
        Map<Integer, List<Long>> second = chunkingService.assignIdsToChunks(ballotIds, config, electionId);

        assertEquals(first, second);
    }

    @Test
    void assignIdsToChunks_assignsEachBallotExactlyOnce() {
        List<Long> ballotIds = new ArrayList<>(List.of(1L, 2L, 3L, 2L, 4L, 4L, 5L));
        ChunkConfiguration config = chunkingService.calculateChunks(5);

        Map<Integer, List<Long>> chunks = chunkingService.assignIdsToChunks(ballotIds, config, 42L);

        assertTrue(chunkingService.verifyIdChunkAssignment(ballotIds, chunks));
        assertDoesNotThrow(() -> chunkingService.assertNoDuplicateIdsAcrossChunks(chunks));
        assertEquals(5, chunks.values().stream().mapToInt(List::size).sum());
    }
}
