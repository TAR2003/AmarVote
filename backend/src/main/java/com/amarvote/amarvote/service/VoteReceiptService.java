package com.amarvote.amarvote.service;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.VoteReceipt;
import com.amarvote.amarvote.repository.VoteReceiptRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class VoteReceiptService {

    private final VoteReceiptRepository voteReceiptRepository;
    private final ReceiptTokenService receiptTokenService;

    public record PreparedReceiptEmail(String plaintextContent, String downloadToken) {}

    @Transactional
    public PreparedReceiptEmail prepareReceiptEmail(
            String voterEmail,
            Election election,
            String voteHash,
            String trackingCode,
            String candidateName,
            String partyName) {
        Instant now = Instant.now();
        UUID receiptId = UUID.randomUUID();

        VoteReceipt receipt = VoteReceipt.builder()
                .receiptId(receiptId)
                .electionId(election.getElectionId())
                .electionTitle(election.getElectionTitle())
                .voteHash(voteHash)
                .trackingCode(trackingCode)
                .candidateName(candidateName)
                .partyName(partyName)
                .createdAt(now)
                .build();

        voteReceiptRepository.save(receipt);

        String emailHash = receiptTokenService.hashEmail(voterEmail);
        String downloadToken = receiptTokenService.generateToken(receiptId, emailHash);

        return new PreparedReceiptEmail(formatPlainText(receipt), downloadToken);
    }

    public Optional<VoteReceipt> findByReceiptId(UUID receiptId) {
        return voteReceiptRepository.findById(receiptId);
    }

    public String formatPlainText(VoteReceipt receipt) {
        String formattedTime = DateTimeFormatter.ISO_OFFSET_DATE_TIME
                .withZone(ZoneOffset.UTC)
                .format(receipt.getCreatedAt());

        String candidate = receipt.getCandidateName();
        if (candidate == null || candidate.isBlank()) {
            candidate = "Unknown";
        }

        String party = receipt.getPartyName();
        if (party == null || party.isBlank()) {
            party = "N/A";
        }

        return ("Election: " + receipt.getElectionTitle() + "\n"
                + "Vote Hash: " + receipt.getVoteHash() + "\n"
                + "Tracking Code: " + receipt.getTrackingCode() + "\n"
                + "Date: " + formattedTime + "\n"
                + "Candidate: " + candidate + "\n"
                + "Party: " + party).trim();
    }
}
