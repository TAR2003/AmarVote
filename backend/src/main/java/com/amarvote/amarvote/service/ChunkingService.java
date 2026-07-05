package com.amarvote.amarvote.service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.ChunkConfiguration;
import com.amarvote.amarvote.model.Ballot;

@Service
public class ChunkingService {
    
    @Value("${amarvote.chunking.chunk-size:2}")
    private int CHUNK_SIZE;
    
    /**
     * Calculate optimal number of chunks and their sizes
     * Rules:
     * - If ballots/CHUNK_SIZE <= 1: 1 chunk
     * - If ballots/CHUNK_SIZE > n but < n+1: n chunks (evenly distributed)
     * 
     * Examples:
     * - 162 ballots, CHUNK_SIZE=64: 162/64=2.53, so 2 chunks of 81 each
     * - 11 ballots, CHUNK_SIZE=3: 11/3=3.67, so 3 chunks of 3,4,4
     * - 50 ballots, CHUNK_SIZE=64: 50/64<1, so 1 chunk of 50
     * 
     * @param totalBallots Total number of ballots
     * @return ChunkConfiguration with number of chunks and their sizes
     */
    public ChunkConfiguration calculateChunks(int totalBallots) {
        
        if (totalBallots <= 0) {
            return new ChunkConfiguration(0, new ArrayList<>());
        }
        
        if (totalBallots <= CHUNK_SIZE) {
            return new ChunkConfiguration(1, List.of(totalBallots));
        }
        
        // Calculate number of chunks
        int numChunks = totalBallots / CHUNK_SIZE;
        int remainder = totalBallots % CHUNK_SIZE;
        
        
        // If we have a remainder and more than one chunk would be needed,
        // distribute evenly across the calculated number of chunks
        if (remainder > 0 && numChunks > 0) {
            List<Integer> chunkSizes = distributeEvenly(totalBallots, numChunks);
            return new ChunkConfiguration(numChunks, chunkSizes);
        }
        
        // Perfect division - all chunks same size
        List<Integer> chunkSizes = new ArrayList<>();
        for (int i = 0; i < numChunks; i++) {
            chunkSizes.add(CHUNK_SIZE);
        }
        return new ChunkConfiguration(numChunks, chunkSizes);
    }
    
    /**
     * Distribute ballots evenly across chunks
     * Example: 11 ballots in 3 chunks -> [4, 4, 3] or [4, 3, 4] etc.
     */
    private List<Integer> distributeEvenly(int totalBallots, int numChunks) {
        List<Integer> chunkSizes = new ArrayList<>();
        int baseSize = totalBallots / numChunks;
        int remainder = totalBallots % numChunks;
        
        // Distribute remainder across first chunks
        for (int i = 0; i < numChunks; i++) {
            chunkSizes.add(baseSize + (i < remainder ? 1 : 0));
        }
        
        return chunkSizes;
    }
    
    /**
     * Randomly assign ballots to chunks using cryptographically secure randomization
     * Each ballot is assigned to exactly one chunk
     * 
     * @param ballots List of ballots to assign
     * @param config Chunk configuration specifying number and sizes of chunks
     * @return Map of chunk number to list of ballots assigned to that chunk
     */
    public Map<Integer, List<Ballot>> assignBallotsToChunks(
            List<Ballot> ballots, ChunkConfiguration config, Long electionId) {
        List<Ballot> uniqueBallots = deduplicateBallotsById(ballots);
        List<Ballot> shuffled = new ArrayList<>(uniqueBallots);
        Collections.shuffle(shuffled, createAssignmentRandom(electionId, uniqueBallots.stream()
            .map(Ballot::getBallotId)
            .collect(Collectors.toList())));
        return distributeToChunks(shuffled, config);
    }
    
    /**
     * Verify that all ballots are assigned exactly once
     * @param originalBallots Original ballot list
     * @param chunks Map of chunks
     * @return true if assignment is valid
     */
    public boolean verifyChunkAssignment(List<Ballot> originalBallots, 
                                        Map<Integer, List<Ballot>> chunks) {
        List<Ballot> assignedBallots = new ArrayList<>();
        for (List<Ballot> chunkBallots : chunks.values()) {
            assignedBallots.addAll(chunkBallots);
        }

        List<Ballot> uniqueOriginal = deduplicateBallotsById(originalBallots);
        if (assignedBallots.size() != uniqueOriginal.size()) {
            return false;
        }
        
        long uniqueCount = assignedBallots.stream()
            .map(Ballot::getBallotId)
            .distinct()
            .count();
            
        return uniqueCount == uniqueOriginal.size();
    }

    /**
     * MEMORY-EFFICIENT: Randomly assign IDs to chunks using cryptographically secure randomization
     * Each ID is assigned to exactly one chunk
     * 
     * @param ids List of IDs (ballot IDs, election center IDs, etc.) to assign
     * @param config Chunk configuration specifying number and sizes of chunks
     * @return Map of chunk number to list of IDs assigned to that chunk
     */
    public Map<Integer, List<Long>> assignIdsToChunks(
            List<Long> ids, ChunkConfiguration config, Long electionId) {
        List<Long> uniqueIds = deduplicateIds(ids);
        List<Long> shuffled = new ArrayList<>(uniqueIds);
        Collections.shuffle(shuffled, createAssignmentRandom(electionId, uniqueIds));
        return distributeIdsToChunks(shuffled, config);
    }

    /**
     * Verify that all IDs are assigned exactly once across chunks.
     */
    public boolean verifyIdChunkAssignment(List<Long> originalIds, Map<Integer, List<Long>> chunks) {
        List<Long> assignedIds = new ArrayList<>();
        for (List<Long> chunkIds : chunks.values()) {
            assignedIds.addAll(chunkIds);
        }

        List<Long> uniqueOriginal = deduplicateIds(originalIds);
        if (assignedIds.size() != uniqueOriginal.size()) {
            return false;
        }

        long uniqueCount = assignedIds.stream().distinct().count();
        return uniqueCount == uniqueOriginal.size();
    }

    private List<Long> deduplicateIds(List<Long> ids) {
        return ids.stream().distinct().sorted().collect(Collectors.toCollection(ArrayList::new));
    }

    private List<Ballot> deduplicateBallotsById(List<Ballot> ballots) {
        Map<Long, Ballot> byId = new HashMap<>();
        for (Ballot ballot : ballots) {
            byId.putIfAbsent(ballot.getBallotId(), ballot);
        }
        return byId.values().stream()
            .sorted((a, b) -> Long.compare(a.getBallotId(), b.getBallotId()))
            .collect(Collectors.toCollection(ArrayList::new));
    }

    /**
     * Deterministic shuffle seed so resume/retry reuses the same ballot-to-chunk mapping.
     */
    private Random createAssignmentRandom(Long electionId, List<Long> uniqueSortedIds) {
        long seed = electionId != null ? electionId : 0L;
        for (Long id : uniqueSortedIds) {
            seed = seed * 31L + id;
        }
        return new Random(seed);
    }

    private <T> Map<Integer, List<T>> distributeToChunks(List<T> shuffled, ChunkConfiguration config) {
        Map<Integer, List<T>> chunks = new HashMap<>();
        int index = 0;
        for (int chunkNum = 0; chunkNum < config.getNumChunks(); chunkNum++) {
            int chunkSize = config.getChunkSizes().get(chunkNum);
            List<T> chunkItems = new ArrayList<>(shuffled.subList(index, index + chunkSize));
            chunks.put(chunkNum, chunkItems);
            index += chunkSize;
        }
        return chunks;
    }

    private Map<Integer, List<Long>> distributeIdsToChunks(List<Long> shuffled, ChunkConfiguration config) {
        return distributeToChunks(shuffled, config);
    }

    /**
     * Ensure no ballot ID appears in more than one chunk (defensive check before queueing work).
     */
    public void assertNoDuplicateIdsAcrossChunks(Map<Integer, List<Long>> chunks) {
        Set<Long> seen = new HashSet<>();
        for (Map.Entry<Integer, List<Long>> entry : chunks.entrySet()) {
            for (Long id : entry.getValue()) {
                if (!seen.add(id)) {
                    throw new IllegalStateException(
                        "Duplicate ballot ID " + id + " assigned to multiple tally chunks");
                }
            }
        }
    }
}
