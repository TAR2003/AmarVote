package com.amarvote.amarvote.controller;

// ElectionController.java

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.amarvote.amarvote.dto.ActivateElectionRequest;
import com.amarvote.amarvote.dto.BenalohChallengeRequest;
import com.amarvote.amarvote.dto.BenalohChallengeResponse;
import com.amarvote.amarvote.dto.CastBallotRequest;
import com.amarvote.amarvote.dto.CastBallotResponse;
import com.amarvote.amarvote.dto.CastEncryptedBallotRequest;
import com.amarvote.amarvote.dto.VoterListUpdateRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CombinePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CombineStatusResponse;
import com.amarvote.amarvote.dto.CreateEncryptedBallotRequest;
import com.amarvote.amarvote.dto.CreateEncryptedBallotResponse;
import com.amarvote.amarvote.dto.CreatePartialDecryptionRequest;
import com.amarvote.amarvote.dto.CreatePartialDecryptionResponse;
import com.amarvote.amarvote.dto.CreateTallyRequest;
import com.amarvote.amarvote.dto.CreateTallyResponse;
import com.amarvote.amarvote.dto.ElectionCreationRequest;
import com.amarvote.amarvote.dto.ElectionDetailResponse;
import com.amarvote.amarvote.dto.ElectionResponse;
import com.amarvote.amarvote.dto.ElectionResultsResponse;
import com.amarvote.amarvote.dto.EligibilityCheckRequest;
import com.amarvote.amarvote.dto.EligibilityCheckResponse;
import com.amarvote.amarvote.dto.GenerateGuardianBackupRequest;
import com.amarvote.amarvote.dto.GuardianBackupSubmitRequest;
import com.amarvote.amarvote.dto.GuardianKeyCeremonySubmitRequest;
import com.amarvote.amarvote.dto.KeyCeremonyPendingElectionResponse;
import com.amarvote.amarvote.dto.KeyCeremonyStatusResponse;
import com.amarvote.amarvote.dto.ScheduledElectionEmailRequest;
import com.amarvote.amarvote.dto.ScheduledElectionEmailResponse;
import com.amarvote.amarvote.dto.UpdateElectionSettingsRequest;
import com.amarvote.amarvote.model.Election;
import com.amarvote.amarvote.service.AuthorizedUserService;
import com.amarvote.amarvote.service.BallotService;
import com.amarvote.amarvote.util.SiteUrlResolver;
import com.amarvote.amarvote.service.CloudinaryService;
import com.amarvote.amarvote.service.ElectionService;
import com.amarvote.amarvote.service.PartialDecryptionService;
import com.amarvote.amarvote.service.ScheduledElectionEmailService;
import com.amarvote.amarvote.service.TallyService;
import com.amarvote.amarvote.util.BallotPaddingUtil;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ElectionController {
    private final ElectionService electionService;
    private final BallotService ballotService;
    private final TallyService tallyService;
    private final PartialDecryptionService partialDecryptionService;
    private final CloudinaryService cloudinaryService;
    private final AuthorizedUserService authorizedUserService;
    private final ScheduledElectionEmailService scheduledElectionEmailService;
    private final ObjectMapper objectMapper;
    private final SiteUrlResolver siteUrlResolver;

    @PostMapping("/create-election")
    public ResponseEntity<?> createElection(
            @Valid @RequestBody ElectionCreationRequest request,
            HttpServletRequest httpRequest) {

        // Get JWT token and user email from request attributes (set by JWTFilter)
        String jwtToken = (String) httpRequest.getAttribute("jwtToken");
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        // System.out.println("Creating election with JWT: " + jwtToken);

        if (userEmail == null || userEmail.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "User authentication required"));
        }

        if (!authorizedUserService.canUserCreateElection(userEmail)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "You do not have permission to create elections."));
        }

        try {
            Election election = electionService.createElection(request, jwtToken, userEmail);
            if (election == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Election creation returned null"));
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(election);
        } catch (IllegalArgumentException e) {
            System.err.println("Validation error creating election: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            System.err.println("Error creating election: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Election creation failed: " + e.getMessage()));
        }
    }

    @GetMapping("/guardian/key-ceremony/pending")
    public ResponseEntity<?> getPendingKeyCeremonies(HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            List<KeyCeremonyPendingElectionResponse> pending = electionService.getPendingKeyCeremoniesForGuardian(userEmail);
            return ResponseEntity.ok(Map.of("success", true, "elections", pending));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/guardian/key-ceremony/generate/{electionId}")
    public ResponseEntity<?> generateGuardianKeyCeremonyCredentials(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> generated = electionService.generateGuardianCredentialsForKeyCeremony(electionId, userEmail);
            return ResponseEntity.ok(generated);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping(value = "/guardian/key-ceremony/submit", consumes = "application/json", produces = "application/json")
    public ResponseEntity<?> submitGuardianKeyCeremony(
            @Valid @RequestBody GuardianKeyCeremonySubmitRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> result = electionService.submitGuardianKeyCeremony(request, userEmail);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/guardian/key-ceremony/backup/context/{electionId}")
    public ResponseEntity<?> getGuardianBackupContext(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> result = electionService.getGuardianBackupRoundContext(electionId, userEmail);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/guardian/key-ceremony/credential-metadata/{electionId}")
    public ResponseEntity<?> getGuardianCredentialMetadataForBackup(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> result = electionService.getGuardianCredentialMetadataForBackup(electionId, userEmail);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping(value = "/guardian/key-ceremony/backup/submit", consumes = "application/json", produces = "application/json")
    public ResponseEntity<?> submitGuardianBackupRound(
            @Valid @RequestBody GuardianBackupSubmitRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> result = electionService.submitGuardianBackupRound(request, userEmail);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

        @PostMapping(value = "/guardian/key-ceremony/backup/generate/{electionId}", consumes = "application/json", produces = "application/json")
    public ResponseEntity<?> generateGuardianBackupRound(
            @PathVariable Long electionId,
            @Valid @RequestBody GenerateGuardianBackupRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> result = electionService.generateGuardianBackupRoundShares(electionId, userEmail, request.encrypted_data());
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/admin/key-ceremony/status/{electionId}")
    public ResponseEntity<?> getAdminKeyCeremonyStatus(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            KeyCeremonyStatusResponse status = electionService.getKeyCeremonyStatus(electionId, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "status", status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/key-ceremony/status/{electionId}")
    public ResponseEntity<?> getKeyCeremonyStatusForParticipants(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            KeyCeremonyStatusResponse status = electionService.getKeyCeremonyStatusForParticipant(electionId, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "status", status));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @PostMapping(value = "/admin/key-ceremony/activate", consumes = "application/json", produces = "application/json")
    public ResponseEntity<?> activateElectionAfterKeyCeremony(
            @Valid @RequestBody ActivateElectionRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> response = electionService.activateElectionAfterKeyCeremony(request, userEmail);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    @GetMapping("/guardian/key-ceremony/password/{electionId}")
    public ResponseEntity<?> getGuardianLocalPassword(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> response = electionService.getGuardianLocalDecryptionPassword(electionId, userEmail);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Get all elections accessible to the current user
     * This endpoint is optimized to fetch all required data in a single query
     * to avoid N+1 query problems when dealing with hundreds of elections.
     */
    @GetMapping("/all-elections")
    public ResponseEntity<List<ElectionResponse>> getAllElections(HttpServletRequest httpRequest) {
        try {
            // Get user email from request attributes (set by JWTFilter)
            String userEmail = (String) httpRequest.getAttribute("userEmail");

            // Alternative: Get user email from Spring Security context
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }


            // Get all elections accessible to the user using the optimized method
            List<ElectionResponse> accessibleElections = electionService.getAllAccessibleElections(userEmail);


            return ResponseEntity.ok(accessibleElections);

        } catch (Exception e) {
            System.err.println("Error fetching elections: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @GetMapping("/election/{id}")
    public ResponseEntity<ElectionDetailResponse> getElectionById(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        try {
            // Get user email from request attributes (set by JWTFilter)
            String userEmail = (String) httpRequest.getAttribute("userEmail");

            // Alternative: Get user email from Spring Security context
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
            }


            // Get election details if user is authorized
            ElectionDetailResponse electionDetails = electionService.getElectionById(id, userEmail);

            if (electionDetails == null) {
                // User is not authorized to view this election or election doesn't exist
                return ResponseEntity.ok(null);
            }

            return ResponseEntity.ok(electionDetails);

        } catch (Exception e) {
            System.err.println("Error fetching election details: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @DeleteMapping("/election/{id}")
    public ResponseEntity<?> deleteElection(@PathVariable Long id, HttpServletRequest httpRequest) {
        try {
            String userEmail = (String) httpRequest.getAttribute("userEmail");
            if (userEmail == null) {
                Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication != null && authentication.isAuthenticated()) {
                    userEmail = authentication.getName();
                }
            }

            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            Map<String, Object> result = electionService.deleteElection(id, userEmail);
            return ResponseEntity.ok(result);
        } catch (IllegalArgumentException e) {
            String message = e.getMessage() == null ? "Invalid request" : e.getMessage();
            HttpStatus status = "Election not found".equals(message) ? HttpStatus.NOT_FOUND : HttpStatus.FORBIDDEN;
            return ResponseEntity.status(status).body(Map.of("success", false, "message", message));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to delete election"));
        }
    }

    @GetMapping("/election/{id}/voters")
    public ResponseEntity<?> getElectionVoters(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            List<ElectionDetailResponse.VoterInfo> voters = electionService.getElectionVoters(id, userEmail);
            if (voters == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Election not found or access denied"));
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "voters", voters,
                    "totalVoters", voters.size(),
                    "votedCount", voters.stream().filter(v -> Boolean.TRUE.equals(v.getHasVoted())).count()
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to load voters"));
        }
    }

    @PostMapping("/election/{id}/voters")
    public ResponseEntity<?> addVotersToElection(
            @PathVariable Long id,
            @Valid @RequestBody VoterListUpdateRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            List<ElectionDetailResponse.VoterInfo> voters = electionService.addVotersToElection(
                    id, userEmail, request.voterEmails());
            return ResponseEntity.ok(Map.of("success", true, "voters", voters));
        } catch (IllegalArgumentException e) {
            String message = e.getMessage() == null ? "Invalid request" : e.getMessage();
            HttpStatus status = message.contains("not found") ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(Map.of("success", false, "message", message));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to add voters"));
        }
    }

    @DeleteMapping("/election/{id}/voters/{voterEmail}")
    public ResponseEntity<?> removeVoterFromElection(
            @PathVariable Long id,
            @PathVariable String voterEmail,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            List<ElectionDetailResponse.VoterInfo> voters = electionService.removeVoterFromElection(
                    id, userEmail, voterEmail);
            return ResponseEntity.ok(Map.of("success", true, "voters", voters));
        } catch (IllegalArgumentException e) {
            String message = e.getMessage() == null ? "Invalid request" : e.getMessage();
            HttpStatus status = message.contains("not found") ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(Map.of("success", false, "message", message));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to remove voter"));
        }
    }

    @DeleteMapping("/election/{id}/voters")
    public ResponseEntity<?> removeAllVotersFromElection(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            List<ElectionDetailResponse.VoterInfo> voters = electionService.removeAllVotersFromElection(id, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "voters", voters));
        } catch (IllegalArgumentException e) {
            String message = e.getMessage() == null ? "Invalid request" : e.getMessage();
            HttpStatus status = message.contains("not found") ? HttpStatus.NOT_FOUND : HttpStatus.BAD_REQUEST;
            return ResponseEntity.status(status).body(Map.of("success", false, "message", message));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to remove voters"));
        }
    }

    @PutMapping("/election/{id}/settings")
    public ResponseEntity<?> updateElectionSettings(
            @PathVariable Long id,
            @Valid @RequestBody UpdateElectionSettingsRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            ElectionDetailResponse updated = electionService.updateElectionSettings(id, request, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "election", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to update election settings"));
        }
    }

    @GetMapping("/election/{id}/scheduled-emails")
    public ResponseEntity<?> listScheduledEmails(
            @PathVariable Long id,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            List<ScheduledElectionEmailResponse> emails = scheduledElectionEmailService.listScheduledEmails(id, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "scheduledEmails", emails));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to load scheduled emails"));
        }
    }

    @PostMapping("/election/{id}/scheduled-emails")
    public ResponseEntity<?> createScheduledEmail(
            @PathVariable Long id,
            @Valid @RequestBody ScheduledElectionEmailRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            ScheduledElectionEmailResponse created =
                    scheduledElectionEmailService.createScheduledEmail(id, request, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "scheduledEmail", created));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to schedule email"));
        }
    }

    @PutMapping("/election/{id}/scheduled-emails/{emailId}")
    public ResponseEntity<?> updateScheduledEmail(
            @PathVariable Long id,
            @PathVariable Long emailId,
            @Valid @RequestBody ScheduledElectionEmailRequest request,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            ScheduledElectionEmailResponse updated =
                    scheduledElectionEmailService.updateScheduledEmail(id, emailId, request, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "scheduledEmail", updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to update scheduled email"));
        }
    }

    @DeleteMapping("/election/{id}/scheduled-emails/{emailId}")
    public ResponseEntity<?> deleteScheduledEmail(
            @PathVariable Long id,
            @PathVariable Long emailId,
            HttpServletRequest httpRequest) {
        try {
            String userEmail = resolveUserEmail(httpRequest);
            if (userEmail == null) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("success", false, "message", "User authentication required"));
            }

            scheduledElectionEmailService.deleteScheduledEmail(id, emailId, userEmail);
            return ResponseEntity.ok(Map.of("success", true, "message", "Scheduled email deleted"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Failed to delete scheduled email"));
        }
    }

    private String resolveUserEmail(HttpServletRequest httpRequest) {
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }
        return userEmail;
    }

    @PostMapping(value = "/cast-ballot", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CastBallotResponse> castBallot(
            @Valid @RequestBody CastBallotRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .errorReason("Unauthorized")
                            .build());
        }

        try {
            CastBallotResponse response = ballotService.castBallot(
                    request, userEmail, siteUrlResolver.resolve(httpRequest));

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .errorReason("Server error: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping(value = "/create-encrypted-ballot", 
                 consumes = MediaType.APPLICATION_OCTET_STREAM_VALUE,
                 produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<CreateEncryptedBallotResponse> createEncryptedBallot(
            @RequestBody byte[] paddedData,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        
        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            // Log received payload size for security monitoring
            
            // Validate payload size matches expected constant size
            if (!BallotPaddingUtil.validateSize(paddedData, BallotPaddingUtil.TARGET_SIZE)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(CreateEncryptedBallotResponse.builder()
                                .success(false)
                                .message("Invalid payload size")
                                .build());
            }

            // Log padding statistics for monitoring

            // Remove PKCS#7 padding to extract original JSON payload
            String jsonPayload = BallotPaddingUtil.parseJsonFromPaddedData(paddedData);
            

            // Parse JSON to CreateEncryptedBallotRequest
            CreateEncryptedBallotRequest request = objectMapper.readValue(jsonPayload, CreateEncryptedBallotRequest.class);
            

            // Process the ballot request
            CreateEncryptedBallotResponse response = ballotService.createEncryptedBallot(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else if ("Service temporarily at capacity".equals(response.getErrorReason())) {
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .header(HttpHeaders.RETRY_AFTER, "5")
                        .body(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (IllegalArgumentException e) {
            // Padding validation errors
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("Invalid request format: " + e.getMessage())
                            .build());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreateEncryptedBallotResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .build());
        }
    }

    @PostMapping(value = "/benaloh-challenge", consumes = "application/json", produces = "application/json")
    public ResponseEntity<BenalohChallengeResponse> performBenalohChallenge(
            @Valid @RequestBody BenalohChallengeRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(BenalohChallengeResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            BenalohChallengeResponse response = ballotService.performBenalohChallenge(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(BenalohChallengeResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .build());
        }
    }

    @PostMapping(value = "/cast-encrypted-ballot", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CastBallotResponse> castEncryptedBallot(
            @Valid @RequestBody CastEncryptedBallotRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .errorReason("Unauthorized")
                            .build());
        }

        try {
            CastBallotResponse response = ballotService.castEncryptedBallot(
                    request, userEmail, siteUrlResolver.resolve(httpRequest));

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CastBallotResponse.builder()
                            .success(false)
                            .message("Internal server error occurred")
                            .errorReason("Server error: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping(value = "/eligibility", consumes = "application/json", produces = "application/json")
    public ResponseEntity<EligibilityCheckResponse> checkEligibility(
            @Valid @RequestBody EligibilityCheckRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(EligibilityCheckResponse.builder()
                            .eligible(false)
                            .message("User authentication required")
                            .reason("Unauthorized")
                            .hasVoted(false)
                            .isElectionActive(false)
                            .electionStatus("N/A")
                            .build());
        }

        try {
            EligibilityCheckResponse response = ballotService.checkEligibility(request, userEmail);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(EligibilityCheckResponse.builder()
                            .eligible(false)
                            .message("Internal server error occurred")
                            .reason("Server error: " + e.getMessage())
                            .hasVoted(false)
                            .isElectionActive(false)
                            .electionStatus("Error")
                            .build());
        }
    }

    /**
     * Initiate tally creation (new endpoint with progress tracking)
     * Returns immediately after initiating async processing
     */
    @PostMapping(value = "/initiate-tally", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreateTallyResponse> initiateTallyCreation(
            @Valid @RequestBody CreateTallyRequest request,
            HttpServletRequest httpRequest) {
        
        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");
        
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }
        
        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }
        
        
        try {
            CreateTallyResponse response = tallyService.initiateTallyCreation(request, userEmail);
            
            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error initiating tally creation: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get tally creation status for an election
     */
    @GetMapping("/election/{electionId}/tally-status")
    public ResponseEntity<?> getTallyStatus(@PathVariable Long electionId) {
        try {
            com.amarvote.amarvote.dto.TallyCreationStatusResponse status = tallyService.getTallyStatus(electionId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            System.err.println("Error fetching tally status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                        "success", false,
                        "message", "Failed to fetch tally status: " + e.getMessage()
                    ));
        }
    }

    @PostMapping(value = "/create-tally", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreateTallyResponse> createTally(
            @Valid @RequestBody CreateTallyRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            // Delegate to new async system
            CreateTallyResponse response = tallyService.initiateTallyCreation(request, userEmail);

            if (response.isSuccess()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreateTallyResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    @PostMapping(value = "/create-partial-decryption", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreatePartialDecryptionResponse> createPartialDecryption(
            @Valid @RequestBody CreatePartialDecryptionRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            CreatePartialDecryptionResponse response = partialDecryptionService.createPartialDecryption(request,
                    userEmail);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error creating partial decryption: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Initiate guardian decryption process (async, returns immediately)
     */
    @PostMapping(value = "/guardian/initiate-decryption", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CreatePartialDecryptionResponse> initiateDecryption(
            @Valid @RequestBody CreatePartialDecryptionRequest request,
            HttpServletRequest httpRequest) {

        // Get user email from request attributes (set by JWTFilter)
        String userEmail = (String) httpRequest.getAttribute("userEmail");

        // Alternative: Get user email from Spring Security context
        if (userEmail == null) {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("User authentication required")
                            .build());
        }

        try {
            CreatePartialDecryptionResponse response = partialDecryptionService.initiateDecryption(request, userEmail);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error initiating decryption: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CreatePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get decryption status for the authenticated guardian
     */
    @GetMapping("/guardian/decryption-status/{electionId}")
    public ResponseEntity<?> getDecryptionStatus(
            @PathVariable Long electionId,
            HttpServletRequest httpRequest) {

        // Get user email from Spring Security context
        String userEmail = null;
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.isAuthenticated()) {
            userEmail = authentication.getName();
        }

        if (userEmail == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of(
                            "success", false,
                            "message", "User not authenticated"
                    ));
        }


        try {
            com.amarvote.amarvote.dto.DecryptionStatusResponse response = 
                partialDecryptionService.getDecryptionStatusByEmail(electionId, userEmail);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error getting decryption status: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "success", false,
                            "message", "Failed to get decryption status: " + e.getMessage()
                    ));
        }
    }

    /**
     * Get decryption status by guardian ID (for timeline and admin views)
     */
    @GetMapping("/guardian/decryption-status/{electionId}/{guardianId}")
    public ResponseEntity<?> getDecryptionStatusByGuardianId(
            @PathVariable Long electionId,
            @PathVariable Long guardianId) {


        try {
            com.amarvote.amarvote.dto.DecryptionStatusResponse response = 
                partialDecryptionService.getDecryptionStatus(electionId, guardianId);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error getting decryption status by guardian ID: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of(
                            "success", false,
                            "message", "Failed to get decryption status: " + e.getMessage()));
        }
    }

    @GetMapping("/election/{electionId}/guardians/decryption-progress")
    public ResponseEntity<?> getAllGuardiansDecryptionProgress(@PathVariable Long electionId) {
        try {
            return ResponseEntity.ok(partialDecryptionService.getAllGuardiansDecryptionProgress(electionId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("success", false, "message", e.getMessage()));
        }
    }

    /**
     * Initiate async combine partial decryption process
     */
    @PostMapping(value = "/initiate-combine", produces = "application/json")
    public ResponseEntity<CombinePartialDecryptionResponse> initiateCombine(
            @RequestParam Long electionId) {


        try {
            // Extract user email from authentication context
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            String userEmail = null;
            
            if (authentication != null && authentication.isAuthenticated()) {
                userEmail = authentication.getName();
            }
            
            if (userEmail == null || userEmail.equals("anonymousUser")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(CombinePartialDecryptionResponse.builder()
                                .success(false)
                                .message("User not authenticated")
                                .build());
            }
            
            CombinePartialDecryptionResponse response = partialDecryptionService.initiateCombine(electionId, userEmail);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error initiating combine: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get combine status for an election
     */
    @GetMapping("/combine-status/{electionId}")
    public ResponseEntity<?> getCombineStatus(@PathVariable Long electionId) {
        try {
            CombineStatusResponse status = partialDecryptionService.getCombineStatus(electionId);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            System.err.println("Error getting combine status: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false,
                            "message", "Failed to get combine status: " + e.getMessage()));
        }
    }

    @PostMapping(value = "/combine-partial-decryption", consumes = "application/json", produces = "application/json")
    public ResponseEntity<CombinePartialDecryptionResponse> combinePartialDecryption(
            @Valid @RequestBody CombinePartialDecryptionRequest request) {


        try {
            CombinePartialDecryptionResponse response = partialDecryptionService.combinePartialDecryption(request);

            if (response.success()) {
                return ResponseEntity.ok(response);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
            }
        } catch (Exception e) {
            System.err.println("Error combining partial decryption: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(CombinePartialDecryptionResponse.builder()
                            .success(false)
                            .message("Internal server error occurred: " + e.getMessage())
                            .build());
        }
    }

    /**
     * Get cached election results with chunk breakdown
     * Returns results from election_result field if already computed
     */
    @GetMapping("/election/{electionId}/cached-results")
    public ResponseEntity<?> getCachedElectionResults(
            @PathVariable Long electionId,
            @RequestParam(defaultValue = "false") boolean includeBallots,
            @RequestParam(defaultValue = "false") boolean includeChunkCiphertext) {
        try {

            Object results = partialDecryptionService.getElectionResults(
                electionId, includeBallots, includeChunkCiphertext);

            if (results == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("success", false, "message", "Results not yet available"));
            }

            return ResponseEntity.ok(Map.of("success", true, "results", results));

        } catch (Exception e) {
            System.err.println("Error fetching cached election results: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Internal server error: " + e.getMessage()));
        }
    }

    @GetMapping("/election/{electionId}/chunk/{electionCenterId}/encrypted-tally")
    public ResponseEntity<?> getChunkEncryptedTally(
            @PathVariable Long electionId,
            @PathVariable Long electionCenterId) {
        try {
            Map<String, Object> response = partialDecryptionService.getChunkEncryptedTally(
                electionId, electionCenterId);
            if (Boolean.FALSE.equals(response.get("success"))) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
            }
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("success", false, "message", "Internal server error: " + e.getMessage()));
        }
    }

    /**
     * Paginated ballots for the Ballots in Tally tab (search/sort across full tally).
     */
    @GetMapping("/election/{electionId}/cached-results/ballots")
    public ResponseEntity<?> getCachedElectionBallots(
            @PathVariable Long electionId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "30") int size,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "ballot_id") String sortBy,
            @RequestParam(defaultValue = "asc") String sortOrder) {
        try {
            Map<String, Object> response = partialDecryptionService.getElectionBallotsPaginated(
                electionId, page, size, search, sortBy, sortOrder);

            if (Boolean.FALSE.equals(response.get("success"))) {
                String message = String.valueOf(response.getOrDefault("message", "Results not yet available"));
                if (message.contains("not yet available")) {
                    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(response);
                }
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
            }

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            System.err.println("Error fetching paginated election ballots: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("success", false, "message", "Internal server error: " + e.getMessage()));
        }
    }

    /**
     * Verify a vote receipt (tracking code + hash) against the final tally.
     */
    @PostMapping("/verify-vote")
    public ResponseEntity<?> verifyVote(@RequestBody Map<String, Object> request) {
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
            if (authentication == null || !authentication.isAuthenticated()
                    || "anonymousUser".equals(authentication.getPrincipal())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                    "status", "error",
                    "message", "Authentication required",
                    "found_ballot", false
                ));
            }

            Object electionIdObj = request.get("election_id");
            String trackingCode = request.get("tracking_code") != null
                ? String.valueOf(request.get("tracking_code")) : null;
            String hashCode = request.get("hash_code") != null
                ? String.valueOf(request.get("hash_code")) : null;

            if (electionIdObj == null) {
                return ResponseEntity.badRequest().body(Map.of(
                    "status", "error",
                    "message", "election_id is required",
                    "found_ballot", false
                ));
            }

            Long electionId = Long.valueOf(String.valueOf(electionIdObj));
            String userEmail = authentication.getName();

            if (!electionService.canUserViewElection(electionId, userEmail)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "status", "error",
                    "message", "You are not authorized to verify votes in this election",
                    "found_ballot", false
                ));
            }

            Map<String, Object> result = partialDecryptionService.verifyVoteInTally(
                electionId, trackingCode, hashCode);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            System.err.println("Error verifying vote: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "status", "error",
                "message", "Internal server error: " + e.getMessage(),
                "found_ballot", false
            ));
        }
    }

    /**
     * Get ballot details including cipher text by election ID and tracking code
     */
    @GetMapping("/ballot-details/{electionId}/{trackingCode}")
    public ResponseEntity<?> getBallotDetails(
            @PathVariable Long electionId,
            @PathVariable String trackingCode) {

        try {

            Map<String, Object> ballotDetails = ballotService.getBallotDetails(electionId, trackingCode);

            if (ballotDetails != null && !ballotDetails.isEmpty()) {
                return ResponseEntity.ok(Map.of(
                        "success", true,
                        "ballot", ballotDetails));
            } else {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                        "success", false,
                        "message", "Ballot not found for the provided tracking code"));
            }
        } catch (Exception e) {
            System.err.println("⚠️ Error fetching ballot details: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                    Map.of(
                            "success", false,
                            "message", "Error fetching ballot details: " + e.getMessage()));
        }
    }

    @PostMapping("/upload-candidate-image")
    public ResponseEntity<?> uploadCandidateImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("candidateName") String candidateName) {
        
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication == null || !authentication.isAuthenticated()
                    || "anonymousUser".equals(authentication.getPrincipal())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                        "success", false,
                        "error", "Authentication required"
                ));
            }

            String userEmail = authentication.getName();
            if (!authorizedUserService.canUserCreateElection(userEmail)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "success", false,
                        "error", "You do not have permission to upload election assets"
                ));
            }

                             
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.CANDIDATE);
            
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Candidate image uploaded successfully",
                "imageUrl", imageUrl
            ));
        } catch (Exception e) {
            System.err.println("Error uploading candidate image: " + e.getMessage());
            e.printStackTrace();
            
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Failed to upload candidate image: " + e.getMessage()
            ));
        }
    }

    @PostMapping("/upload-party-image")
    public ResponseEntity<?> uploadPartyImage(
            @RequestParam("file") MultipartFile file,
            @RequestParam("partyName") String partyName) {
        
        try {
            Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication == null || !authentication.isAuthenticated()
                    || "anonymousUser".equals(authentication.getPrincipal())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of(
                        "success", false,
                        "error", "Authentication required"
                ));
            }

            String userEmail = authentication.getName();
            if (!authorizedUserService.canUserCreateElection(userEmail)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "success", false,
                        "error", "You do not have permission to upload election assets"
                ));
            }

                             
            String imageUrl = cloudinaryService.uploadImage(file, CloudinaryService.ImageType.PARTY);
            
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Party image uploaded successfully",
                "imageUrl", imageUrl
            ));
        } catch (Exception e) {
            System.err.println("Error uploading party image: " + e.getMessage());
            e.printStackTrace();
            
            return ResponseEntity.badRequest().body(Map.of(
                "success", false,
                "error", "Failed to upload party image: " + e.getMessage()
            ));
        }
    }

    /**
     * Get guardians information for verification tab
     * Excludes sensitive credentials field
     */
    @GetMapping("/election/{id}/guardians")
    public ResponseEntity<?> getElectionGuardians(
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean summary) {
        try {
            List<Map<String, Object>> guardians = summary
                ? electionService.getGuardiansForVerificationSummary(id)
                : electionService.getGuardiansForVerification(id);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "guardians", guardians
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Failed to retrieve guardian information: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/election/{electionId}/guardians/{guardianId}")
    public ResponseEntity<?> getElectionGuardianDetail(
            @PathVariable Long electionId,
            @PathVariable Long guardianId) {
        try {
            Map<String, Object> guardian = electionService.getGuardianVerificationDetail(electionId, guardianId);
            if (guardian == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "success", false,
                    "error", "Guardian not found"
                ));
            }
            return ResponseEntity.ok(Map.of("success", true, "guardian", guardian));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Failed to retrieve guardian detail: " + e.getMessage()
            ));
        }
    }

    /**
     * Get compensated decryptions information for verification tab
     */
    @GetMapping("/election/{id}/compensated-decryptions")
    public ResponseEntity<?> getElectionCompensatedDecryptions(
            @PathVariable Long id,
            @RequestParam(defaultValue = "true") boolean summary) {
        try {
            List<Map<String, Object>> compensatedDecryptions = summary
                ? electionService.getCompensatedDecryptionsSummary(id)
                : electionService.getCompensatedDecryptionsForVerification(id);
            
            return ResponseEntity.ok(Map.of(
                "success", true,
                "compensatedDecryptions", compensatedDecryptions
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Failed to retrieve compensated decryption information: " + e.getMessage()
            ));
        }
    }

    @GetMapping("/election/{electionId}/compensated-decryptions/{compensatedDecryptionId}")
    public ResponseEntity<?> getElectionCompensatedDecryptionDetail(
            @PathVariable Long electionId,
            @PathVariable Long compensatedDecryptionId) {
        try {
            Map<String, Object> detail = electionService.getCompensatedDecryptionDetail(
                electionId, compensatedDecryptionId);
            if (detail == null) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                    "success", false,
                    "error", "Compensated decryption not found"
                ));
            }
            return ResponseEntity.ok(Map.of(
                "success", true,
                "compensatedDecryption", detail
            ));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "error", "Failed to retrieve compensated decryption detail: " + e.getMessage()
            ));
        }
    }

    /**
     * Get election results with chunk information
     */
    @GetMapping("/election/{id}/results")
    public ResponseEntity<ElectionResultsResponse> getElectionResults(@PathVariable Long id) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        String userEmail = authentication.getName();
        
        ElectionResultsResponse results = electionService.getElectionResults(id, userEmail);
        
        if (results.isSuccess()) {
            return ResponseEntity.ok(results);
        } else {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(results);
        }
    }
}