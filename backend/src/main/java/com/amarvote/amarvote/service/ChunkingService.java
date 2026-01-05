package com.amarvote.amarvote.service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.amarvote.amarvote.dto.ChunkConfiguration;
import com.amarvote.amarvote.model.Ballot;

@Service
public class ChunkingService {
    
    @Value("${amarvote.chunking.chunk-size:2}")
    private int CHUNK_SIZE;
    
    private static final SecureRandom secureRandom = new SecureRandom();
    
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
        
        // If we have a remainder and more than one chunk would be needed,
        // distribute evenly across the calculated number of chunks
        if (totalBallots % CHUNK_SIZE > 0 && numChunks > 0) {
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
            List<Ballot> ballots, ChunkConfiguration config) {
        
        // Shuffle ballots using secure random
        List<Ballot> shuffled = new ArrayList<>(ballots);
        Collections.shuffle(shuffled, secureRandom);
        
        Map<Integer, List<Ballot>> chunks = new HashMap<>();
        int ballotIndex = 0;
        
        // Distribute shuffled ballots according to chunk sizes
        for (int chunkNum = 0; chunkNum < config.getNumChunks(); chunkNum++) {
            int chunkSize = config.getChunkSizes().get(chunkNum);
            List<Ballot> chunkBallots = new ArrayList<>(
                shuffled.subList(ballotIndex, ballotIndex + chunkSize));
            chunks.put(chunkNum, chunkBallots);
            ballotIndex += chunkSize;
        }
        
        return chunks;
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
        
        // Check all ballots are assigned
        if (assignedBallots.size() != originalBallots.size()) {
            return false;
        }
        
        // Check no duplicates
        long uniqueCount = assignedBallots.stream()
            .map(Ballot::getBallotId)
            .distinct()
            .count();
            
        return uniqueCount == originalBallots.size();
    }
}
