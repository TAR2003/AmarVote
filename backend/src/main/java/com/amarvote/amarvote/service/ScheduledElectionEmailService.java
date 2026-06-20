package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.ScheduledElectionEmailRequest;
import com.amarvote.amarvote.dto.ScheduledElectionEmailResponse;
import com.amarvote.amarvote.model.AllowedVoter;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.model.ElectionCoAdmin;
import com.amarvote.amarvote.model.Guardian;
import com.amarvote.amarvote.model.ScheduledElectionEmail;
import com.amarvote.amarvote.repository.AllowedVoterRepository;
import com.amarvote.amarvote.repository.ElectionCoAdminRepository;
import com.amarvote.amarvote.repository.ElectionRepository;
import com.amarvote.amarvote.repository.GuardianRepository;
import com.amarvote.amarvote.repository.ScheduledElectionEmailRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class ScheduledElectionEmailService {

    private final ScheduledElectionEmailRepository scheduledEmailRepository;
    private final ElectionRepository electionRepository;
    private final AllowedVoterRepository allowedVoterRepository;
    private final GuardianRepository guardianRepository;
    private final ElectionCoAdminRepository electionCoAdminRepository;
    private final EmailService emailService;

    public List<ScheduledElectionEmailResponse> listScheduledEmails(Long electionId, String userEmail) {
        Election election = requireElection(electionId);
        requireElectionAdmin(election, userEmail, "Only election admins can view scheduled emails");

        return scheduledEmailRepository.findByElectionIdOrderByScheduledTimeDesc(electionId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ScheduledElectionEmailResponse createScheduledEmail(
            Long electionId, ScheduledElectionEmailRequest request, String userEmail) {
        Election election = requireElection(electionId);
        requireElectionAdmin(election, userEmail, "Only election admins can schedule emails");

        validateRecipientGroup(request.recipientGroup());
        validateScheduledTime(request.scheduledTime());

        ScheduledElectionEmail entity = ScheduledElectionEmail.builder()
                .electionId(electionId)
                .recipientGroup(normalizeGroup(request.recipientGroup()))
                .emailBody(request.emailBody().trim())
                .scheduledTime(request.scheduledTime())
                .sent(false)
                .build();

        return toResponse(scheduledEmailRepository.save(entity));
    }

    @Transactional
    public ScheduledElectionEmailResponse updateScheduledEmail(
            Long electionId, Long emailId, ScheduledElectionEmailRequest request, String userEmail) {
        Election election = requireElection(electionId);
        requireElectionAdmin(election, userEmail, "Only election admins can edit scheduled emails");

        ScheduledElectionEmail entity = requireScheduledEmail(electionId, emailId);
        if (Boolean.TRUE.equals(entity.getSent())) {
            throw new IllegalArgumentException("Sent emails cannot be edited");
        }

        validateRecipientGroup(request.recipientGroup());
        validateScheduledTime(request.scheduledTime());

        entity.setRecipientGroup(normalizeGroup(request.recipientGroup()));
        entity.setEmailBody(request.emailBody().trim());
        entity.setScheduledTime(request.scheduledTime());

        return toResponse(scheduledEmailRepository.save(entity));
    }

    @Transactional
    public void deleteScheduledEmail(Long electionId, Long emailId, String userEmail) {
        Election election = requireElection(electionId);
        requireElectionAdmin(election, userEmail, "Only election admins can delete scheduled emails");

        ScheduledElectionEmail entity = requireScheduledEmail(electionId, emailId);
        scheduledEmailRepository.delete(entity);
    }

    @Scheduled(fixedDelayString = "${amarvote.scheduled-email.poll-ms:60000}")
    @Transactional
    public void dispatchDueEmails() {
        List<ScheduledElectionEmail> dueEmails =
                scheduledEmailRepository.findByScheduledTimeLessThanEqualAndSentFalse(Instant.now());
        if (dueEmails.isEmpty()) {
            return;
        }

        for (ScheduledElectionEmail scheduled : dueEmails) {
            try {
                Election election = electionRepository.findById(scheduled.getElectionId()).orElse(null);
                if (election == null) {
                    scheduled.setSent(true);
                    scheduled.setSentAt(Instant.now());
                    scheduledEmailRepository.save(scheduled);
                    continue;
                }

                List<String> recipients = resolveRecipients(election, scheduled.getRecipientGroup());
                String subject = buildSubject(election, scheduled.getRecipientGroup());

                for (String recipient : recipients) {
                    emailService.sendReminderEmail(recipient, subject, scheduled.getEmailBody());
                }

                scheduled.setSent(true);
                scheduled.setSentAt(Instant.now());
                scheduledEmailRepository.save(scheduled);
            } catch (Exception ex) {
                System.err.println("Failed to dispatch scheduled email " + scheduled.getEmailId() + ": "
                        + ex.getMessage());
            }
        }
    }

    public String buildDefaultTemplate(Election election, String recipientGroup) {
        String title = election.getElectionTitle() == null ? "Election" : election.getElectionTitle();
        String description = election.getElectionDescription() == null ? "" : election.getElectionDescription();
        String electionLink = "/election-page/" + election.getElectionId();

        return switch (normalizeGroup(recipientGroup)) {
            case ScheduledElectionEmail.GROUP_VOTERS -> "Dear voter,\n\n"
                    + "This is a message regarding the election \"" + title + "\".\n\n"
                    + "Election description:\n" + description + "\n\n"
                    + "Election page: " + electionLink + "\n\n"
                    + "Please cast your vote within the election window.\n\n"
                    + "Regards,\nAmarVote Team";
            case ScheduledElectionEmail.GROUP_GUARDIANS -> "Dear guardian,\n\n"
                    + "This is a message regarding the election \"" + title + "\" where you serve as a guardian.\n\n"
                    + "Election description:\n" + description + "\n\n"
                    + "Election page: " + electionLink + "\n\n"
                    + "Please complete any pending guardian duties for this election.\n\n"
                    + "Regards,\nAmarVote Team";
            case ScheduledElectionEmail.GROUP_ADMINS -> "Dear election administrator,\n\n"
                    + "This is a message regarding the election \"" + title + "\" that you administer.\n\n"
                    + "Election description:\n" + description + "\n\n"
                    + "Election page: " + electionLink + "\n\n"
                    + "Please review the election dashboard for any pending actions.\n\n"
                    + "Regards,\nAmarVote Team";
            default -> throw new IllegalArgumentException("Unsupported recipient group: " + recipientGroup);
        };
    }

    List<String> resolveRecipients(Election election, String recipientGroup) {
        Long electionId = election.getElectionId();
        Set<String> emails = new LinkedHashSet<>();

        switch (normalizeGroup(recipientGroup)) {
            case ScheduledElectionEmail.GROUP_VOTERS -> allowedVoterRepository.findByElectionId(electionId).stream()
                    .map(AllowedVoter::getUserEmail)
                    .forEach(emails::add);
            case ScheduledElectionEmail.GROUP_GUARDIANS -> guardianRepository.findByElectionId(electionId).stream()
                    .map(Guardian::getUserEmail)
                    .forEach(emails::add);
            case ScheduledElectionEmail.GROUP_ADMINS -> {
                if (election.getAdminEmail() != null) {
                    emails.add(election.getAdminEmail());
                }
                electionCoAdminRepository.findByElectionId(electionId).stream()
                        .map(ElectionCoAdmin::getAdminEmail)
                        .forEach(emails::add);
            }
            default -> throw new IllegalArgumentException("Unsupported recipient group: " + recipientGroup);
        }

        return sanitize(new ArrayList<>(emails));
    }

    private String buildSubject(Election election, String recipientGroup) {
        String title = election.getElectionTitle() == null ? "Election" : election.getElectionTitle();
        return switch (normalizeGroup(recipientGroup)) {
            case ScheduledElectionEmail.GROUP_VOTERS -> "Election update for voters: \"" + title + "\"";
            case ScheduledElectionEmail.GROUP_GUARDIANS -> "Election update for guardians: \"" + title + "\"";
            case ScheduledElectionEmail.GROUP_ADMINS -> "Election update for administrators: \"" + title + "\"";
            default -> "Election update: \"" + title + "\"";
        };
    }

    private ScheduledElectionEmail requireScheduledEmail(Long electionId, Long emailId) {
        ScheduledElectionEmail entity = scheduledEmailRepository.findById(emailId)
                .orElseThrow(() -> new IllegalArgumentException("Scheduled email not found"));
        if (!entity.getElectionId().equals(electionId)) {
            throw new IllegalArgumentException("Scheduled email does not belong to this election");
        }
        return entity;
    }

    private Election requireElection(Long electionId) {
        return electionRepository.findById(electionId)
                .orElseThrow(() -> new IllegalArgumentException("Election not found"));
    }

    private void requireElectionAdmin(Election election, String userEmail, String message) {
        if (!isElectionAdmin(election, userEmail)) {
            throw new IllegalArgumentException(message);
        }
    }

    private boolean isElectionAdmin(Election election, String userEmail) {
        if (userEmail == null || userEmail.isBlank()) {
            return false;
        }
        String normalized = normalizeEmail(userEmail);
        if (normalized.equalsIgnoreCase(normalizeEmail(election.getAdminEmail()))) {
            return true;
        }
        return electionCoAdminRepository.findByElectionId(election.getElectionId()).stream()
                .anyMatch(co -> normalized.equalsIgnoreCase(normalizeEmail(co.getAdminEmail())));
    }

    private void validateRecipientGroup(String group) {
        normalizeGroup(group);
    }

    private String normalizeGroup(String group) {
        if (group == null || group.isBlank()) {
            throw new IllegalArgumentException("Recipient group is required");
        }
        String normalized = group.trim().toLowerCase();
        if (!ScheduledElectionEmail.GROUP_VOTERS.equals(normalized)
                && !ScheduledElectionEmail.GROUP_GUARDIANS.equals(normalized)
                && !ScheduledElectionEmail.GROUP_ADMINS.equals(normalized)) {
            throw new IllegalArgumentException("Recipient group must be voters, guardians, or admins");
        }
        return normalized;
    }

    private void validateScheduledTime(Instant scheduledTime) {
        if (scheduledTime == null) {
            throw new IllegalArgumentException("Scheduled time is required");
        }
    }

    private List<String> sanitize(List<String> rawEmails) {
        if (rawEmails == null || rawEmails.isEmpty()) {
            return List.of();
        }
        return rawEmails.stream()
                .map(this::normalizeEmail)
                .filter(email -> email != null && !email.isBlank())
                .distinct()
                .collect(Collectors.toList());
    }

    private String normalizeEmail(String email) {
        return email == null ? null : email.trim().toLowerCase();
    }

    private ScheduledElectionEmailResponse toResponse(ScheduledElectionEmail entity) {
        return ScheduledElectionEmailResponse.builder()
                .emailId(entity.getEmailId())
                .electionId(entity.getElectionId())
                .recipientGroup(entity.getRecipientGroup())
                .emailBody(entity.getEmailBody())
                .scheduledTime(entity.getScheduledTime())
                .sent(entity.getSent())
                .sentAt(entity.getSentAt())
                .createdAt(entity.getCreatedAt())
                .build();
    }
}
