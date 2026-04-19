package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ElectionReminderScheduler {

    private final ElectionRepository electionRepository;
    private final AllowedVoterRepository allowedVoterRepository;
    private final EmailService emailService;
    private final ObjectMapper objectMapper;

    @Scheduled(fixedDelayString = "${amarvote.reminder.poll-ms:60000}")
    @Transactional
    public void dispatchDueReminders() {
        List<Election> dueElections = electionRepository.findByReminderTimeLessThanEqualAndReminderSentFalse(Instant.now());
        if (dueElections.isEmpty()) {
            return;
        }

        for (Election election : dueElections) {
            try {
                List<String> recipients = resolveRecipients(election);
                if (recipients.isEmpty()) {
                    election.setReminderSent(true);
                    electionRepository.save(election);
                    continue;
                }

                String subject = defaultIfBlank(election.getReminderSubject(),
                        "Reminder: \"" + election.getElectionTitle() + "\" is opening soon");
                String body = defaultIfBlank(election.getReminderBody(), buildFallbackReminderBody(election));

                for (String recipient : recipients) {
                    emailService.sendReminderEmail(recipient, subject, body);
                }

                election.setReminderSent(true);
                electionRepository.save(election);
            } catch (Exception ex) {
                System.err.println("❌ Failed to schedule reminder emails for election " + election.getElectionId() + ": " + ex.getMessage());
            }
        }
    }

    private List<String> resolveRecipients(Election election) {
        try {
            if (election.getReminderRecipients() != null && !election.getReminderRecipients().isBlank()) {
                List<String> parsed = objectMapper.readValue(election.getReminderRecipients(), new TypeReference<List<String>>() {});
                return sanitize(parsed);
            }
        } catch (Exception ignored) {
            // Fall back to voter list.
        }

        List<String> voterEmails = allowedVoterRepository.findByElectionId(election.getElectionId())
                .stream()
                .map(AllowedVoter::getUserEmail)
                .collect(Collectors.toList());
        return sanitize(voterEmails);
    }

    private List<String> sanitize(List<String> rawEmails) {
        if (rawEmails == null || rawEmails.isEmpty()) {
            return new ArrayList<>();
        }
        return rawEmails.stream()
                .map(email -> email == null ? null : email.trim().toLowerCase())
                .filter(email -> email != null && !email.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private String defaultIfBlank(String value, String fallback) {
        return (value == null || value.isBlank()) ? fallback : value;
    }

    private String buildFallbackReminderBody(Election election) {
        String title = election.getElectionTitle() == null ? "Election" : election.getElectionTitle();
        String description = election.getElectionDescription() == null ? "" : election.getElectionDescription();
        return "Dear voter,\n\n"
                + "This is a reminder that the election \"" + title + "\" is scheduled to start soon.\n\n"
                + "Election description:\n" + description + "\n\n"
                + "Election page: /election/" + election.getElectionId() + "\n\n"
                + "Please cast your vote within the election window.\n\n"
                + "Regards,\nAmarVote Team";
    }
}
