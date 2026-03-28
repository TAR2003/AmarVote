package com.amarvote.amarvote.service;

import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.dto.AuthorizedUserUpdateRequestDto;
import com.amarvote.amarvote.dto.AuthorizedUserCreateRequestDto;
import com.amarvote.amarvote.model.AppUser;
import com.amarvote.amarvote.model.AuthorizedUserAuditLog;
import com.amarvote.amarvote.model.AuthorizedUser;
import com.amarvote.amarvote.repository.AppUserRepository;
import com.amarvote.amarvote.repository.AuthorizedUserAuditLogRepository;
import com.amarvote.amarvote.repository.AuthorizedUserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthorizedUserService {

    public static final String USER_TYPE_USER = "user";
    public static final String USER_TYPE_ADMIN = "admin";
    public static final String USER_TYPE_OWNER = "owner";

    private static final Set<String> MANAGE_ROLES = Set.of(USER_TYPE_ADMIN, USER_TYPE_OWNER);
    private static final Set<String> API_LOG_ROLES = Set.of(USER_TYPE_ADMIN, USER_TYPE_OWNER);
    private static final Pattern CSV_SPLITTER = Pattern.compile("[\\n\\r,;\\t ]+");

    private final AuthorizedUserRepository authorizedUserRepository;
    private final AppUserRepository appUserRepository;
    private final AuthorizedUserAuditLogRepository authorizedUserAuditLogRepository;

    public String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional(readOnly = true)
    public void ensureAllowedForRegistration(String email) {
        AuthorizedUser authorizedUser = getAllowedRecordOrThrow(email);
        if (Boolean.TRUE.equals(authorizedUser.getRegisteredOrNot())) {
            throw new IllegalArgumentException("This authorized email is already registered. Please login.");
        }
    }

    @Transactional(readOnly = true)
    public void ensureAllowedForLogin(String email) {
        AuthorizedUser authorizedUser = getAllowedRecordOrThrow(email);
        if (!Boolean.TRUE.equals(authorizedUser.getRegisteredOrNot())) {
            throw new IllegalArgumentException("Your authorized account is not registered yet.");
        }
    }

    @Transactional
    public void markRegistered(String email) {
        String normalized = normalizeEmail(email);
        authorizedUserRepository.findByEmail(normalized).ifPresent(record -> {
            record.setRegisteredOrNot(true);
            authorizedUserRepository.save(record);
        });
    }

    @Transactional
    public void markSuccessfulLogin(String email) {
        markLastActive(email);
    }

    @Transactional
    public void markLastActive(String email) {
        String normalized = normalizeEmail(email);
        authorizedUserRepository.findByEmail(normalized).ifPresent(record -> {
            record.setRegisteredOrNot(true);
            record.setLastLogin(Instant.now());
            authorizedUserRepository.save(record);
        });
    }

    @Transactional(readOnly = true)
    public boolean canViewApiLogs(String email) {
        String normalized = normalizeEmail(email);
        return authorizedUserRepository.findByEmail(normalized)
                .filter(record -> Boolean.TRUE.equals(record.getIsAllowed()))
                .map(record -> API_LOG_ROLES.contains(normalizeRole(record.getUserType())))
                .orElse(false);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getCurrentUserAccess(String email) {
        String normalized = normalizeEmail(email);
        Optional<AuthorizedUser> recordOpt = authorizedUserRepository.findByEmail(normalized);
        String currentUserType = recordOpt.map(r -> normalizeRole(r.getUserType())).orElse(USER_TYPE_USER);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("email", normalized);
        response.put("userType", currentUserType);
        response.put("isAllowed", recordOpt.map(r -> Boolean.TRUE.equals(r.getIsAllowed())).orElse(false));
        response.put("canManageAuthorizedUsers", MANAGE_ROLES.contains(currentUserType));
        response.put("canViewApiLogs", canViewApiLogs(normalized));
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAuthorizedUsers(String actorEmail) {
        String normalizedActor = normalizeEmail(actorEmail);
        Optional<AuthorizedUser> actorOpt = authorizedUserRepository.findByEmail(normalizedActor);
        String actorType = actorOpt.map(r -> normalizeRole(r.getUserType())).orElse(USER_TYPE_USER);
        boolean actorCanManage = MANAGE_ROLES.contains(actorType);

        List<Map<String, Object>> users = authorizedUserRepository.findAll().stream()
                .sorted((a, b) -> a.getEmail().compareToIgnoreCase(b.getEmail()))
                .map(row -> {
                    String targetType = normalizeRole(row.getUserType());
                    boolean canEditRow = actorCanManage && (USER_TYPE_OWNER.equals(actorType) || !USER_TYPE_OWNER.equals(targetType));

                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("authorizedUserId", row.getAuthorizedUserId());
                    item.put("email", row.getEmail());
                    item.put("apiLogViewerAllowed", API_LOG_ROLES.contains(targetType));
                    item.put("registeredOrNot", Boolean.TRUE.equals(row.getRegisteredOrNot()));
                    item.put("userType", targetType);
                    item.put("lastActive", row.getLastLogin());
                    item.put("createdAt", row.getCreatedAt());
                    item.put("updatedAt", row.getUpdatedAt());
                    item.put("canEdit", canEditRow);
                    return item;
                })
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("currentUserEmail", normalizedActor);
        response.put("currentUserType", actorType);
        response.put("canManage", actorCanManage);
        response.put("users", users);
        return response;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getAuditLogs(String actorEmail) {
        AuthorizedUser actor = getAllowedRecordOrThrow(actorEmail);
        String actorType = normalizeRole(actor.getUserType());
        if (!MANAGE_ROLES.contains(actorType)) {
            throw new IllegalArgumentException("Only admin or owner can view authorization action logs.");
        }

        List<Map<String, Object>> logs = authorizedUserAuditLogRepository.findTop200ByOrderByCreatedAtDesc().stream()
                .map(log -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("auditLogId", log.getAuditLogId());
                    item.put("actorEmail", log.getActorEmail());
                    item.put("targetEmail", log.getTargetEmail());
                    item.put("actionType", log.getActionType());
                    item.put("details", log.getDetails());
                    item.put("createdAt", log.getCreatedAt());
                    return item;
                })
                .toList();

        return Map.of("logs", logs);
    }

    @Transactional
    public Map<String, Object> addAuthorizedUser(String actorEmail, AuthorizedUserCreateRequestDto request) {
        AuthorizedUser actor = getAllowedRecordOrThrow(actorEmail);
        String actorType = normalizeRole(actor.getUserType());
        if (!MANAGE_ROLES.contains(actorType)) {
            throw new IllegalArgumentException("Only admin or owner can add authorized users.");
        }

        String email = normalizeEmail(request.getEmail());
        if (email.isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }
        if (authorizedUserRepository.existsByEmail(email)) {
            throw new IllegalArgumentException("Email already exists in authorized users table.");
        }

        String userType = normalizeRole(request.getUserType());
        if (USER_TYPE_ADMIN.equals(actorType) && USER_TYPE_OWNER.equals(userType)) {
            throw new IllegalArgumentException("Admin cannot assign owner role.");
        }

        boolean registered = appUserRepository.existsByEmail(email);

        AuthorizedUser saved = authorizedUserRepository.save(AuthorizedUser.builder()
                .email(email)
                .isAllowed(true)
                .registeredOrNot(registered)
                .userType(userType)
                .build());

        appendAudit(actorEmail, email, "ADD_USER", "Added authorized user with role " + userType);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("authorizedUserId", saved.getAuthorizedUserId());
        response.put("email", saved.getEmail());
        response.put("registeredOrNot", Boolean.TRUE.equals(saved.getRegisteredOrNot()));
        response.put("userType", normalizeRole(saved.getUserType()));
        response.put("lastActive", saved.getLastLogin());
        return response;
    }

    @Transactional
    public Map<String, Object> removeAuthorizedUser(String actorEmail, Long authorizedUserId) {
        AuthorizedUser actor = getAllowedRecordOrThrow(actorEmail);
        String actorType = normalizeRole(actor.getUserType());
        if (!MANAGE_ROLES.contains(actorType)) {
            throw new IllegalArgumentException("Only admin or owner can remove authorized users.");
        }

        AuthorizedUser target = authorizedUserRepository.findById(authorizedUserId)
                .orElseThrow(() -> new IllegalArgumentException("Authorized user not found"));

        String targetRole = normalizeRole(target.getUserType());
        if (USER_TYPE_ADMIN.equals(actorType) && USER_TYPE_OWNER.equals(targetRole)) {
            throw new IllegalArgumentException("Admin cannot remove owner records.");
        }
        if (normalizeEmail(actorEmail).equals(target.getEmail())) {
            throw new IllegalArgumentException("You cannot remove your own authorized record.");
        }

        String removedEmail = target.getEmail();
        authorizedUserRepository.delete(target);
        appendAudit(actorEmail, removedEmail, "REMOVE_USER", "Removed user from authorized users list");

        return Map.of("removed", true, "email", removedEmail);
    }

    @Transactional
    public Map<String, Object> bulkAddAuthorizedUsers(String actorEmail, String csvContent) {
        AuthorizedUser actor = getAllowedRecordOrThrow(actorEmail);
        String actorType = normalizeRole(actor.getUserType());
        if (!MANAGE_ROLES.contains(actorType)) {
            throw new IllegalArgumentException("Only admin or owner can upload users.");
        }

        if (csvContent == null || csvContent.isBlank()) {
            throw new IllegalArgumentException("CSV file is empty.");
        }

        List<String> rawTokens = CSV_SPLITTER.splitAsStream(csvContent)
                .map(this::normalizeEmail)
                .filter(token -> !token.isBlank())
                .distinct()
                .toList();

        int created = 0;
        int skipped = 0;
        for (String token : rawTokens) {
            if (!token.contains("@") || token.startsWith("email")) {
                skipped++;
                continue;
            }

            if (authorizedUserRepository.existsByEmail(token)) {
                skipped++;
                continue;
            }

            boolean registered = appUserRepository.existsByEmail(token);
            authorizedUserRepository.save(AuthorizedUser.builder()
                    .email(token)
                    .isAllowed(true)
                    .registeredOrNot(registered)
                    .userType(USER_TYPE_USER)
                    .build());
            created++;
        }

        appendAudit(actorEmail, "bulk", "BULK_ADD_USERS", "Added " + created + " user(s), skipped " + skipped + " token(s)");

        return Map.of("created", created, "skipped", skipped, "totalTokens", rawTokens.size());
    }

    @Transactional
    public Map<String, Object> updateAuthorizedUser(String actorEmail, Long authorizedUserId, AuthorizedUserUpdateRequestDto request) {
        AuthorizedUser actor = getAllowedRecordOrThrow(actorEmail);
        String actorType = normalizeRole(actor.getUserType());

        if (!MANAGE_ROLES.contains(actorType)) {
            throw new IllegalArgumentException("Only admin or owner can modify authorized users.");
        }

        AuthorizedUser target = authorizedUserRepository.findById(authorizedUserId)
                .orElseThrow(() -> new IllegalArgumentException("Authorized user not found"));

        String targetType = normalizeRole(target.getUserType());
        if (USER_TYPE_ADMIN.equals(actorType) && USER_TYPE_OWNER.equals(targetType)) {
            throw new IllegalArgumentException("Admin cannot modify owner records.");
        }

        if (request.getUserType() != null) {
            String previousType = targetType;
            String requestedType = normalizeRole(request.getUserType());
            if (USER_TYPE_ADMIN.equals(actorType) && USER_TYPE_OWNER.equals(requestedType)) {
                throw new IllegalArgumentException("Admin cannot assign owner role.");
            }
            target.setUserType(requestedType);

            if (!requestedType.equals(previousType)) {
                String action = USER_TYPE_ADMIN.equals(requestedType) ? "PROMOTE_TO_ADMIN"
                        : USER_TYPE_USER.equals(requestedType) && USER_TYPE_ADMIN.equals(previousType) ? "DEMOTE_TO_USER"
                        : "CHANGE_ROLE";
                appendAudit(actorEmail, target.getEmail(), action,
                        "Changed role from " + previousType + " to " + requestedType);
            }
        }

        if (request.getEmail() != null && !request.getEmail().isBlank()) {
            String newEmail = normalizeEmail(request.getEmail());
            if (!newEmail.equals(target.getEmail()) && authorizedUserRepository.existsByEmail(newEmail)) {
                throw new IllegalArgumentException("Email already exists in authorized users table.");
            }
            target.setEmail(newEmail);
            appendAudit(actorEmail, newEmail, "UPDATE_EMAIL", "Updated authorized user email");
        }

        AuthorizedUser saved = authorizedUserRepository.save(target);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("authorizedUserId", saved.getAuthorizedUserId());
        response.put("email", saved.getEmail());
        response.put("apiLogViewerAllowed", API_LOG_ROLES.contains(normalizeRole(saved.getUserType())));
        response.put("registeredOrNot", Boolean.TRUE.equals(saved.getRegisteredOrNot()));
        response.put("userType", normalizeRole(saved.getUserType()));
        response.put("lastActive", saved.getLastLogin());
        response.put("updatedAt", saved.getUpdatedAt());
        return response;
    }

    @Transactional
    public void bootstrapAuthorizedUsers(String adminEmailsCsv) {
        syncExistingRegisteredUsers();
        seedAdminEmails(adminEmailsCsv);
    }

    @Transactional
    public void syncExistingRegisteredUsers() {
        List<AppUser> existingUsers = appUserRepository.findAll();
        for (AppUser appUser : existingUsers) {
            String email = normalizeEmail(appUser.getEmail());
            if (email.isBlank()) {
                continue;
            }

            authorizedUserRepository.findByEmail(email).ifPresentOrElse(record -> {
                if (!Boolean.TRUE.equals(record.getRegisteredOrNot())) {
                    record.setRegisteredOrNot(true);
                    authorizedUserRepository.save(record);
                }
            }, () -> {
                AuthorizedUser row = AuthorizedUser.builder()
                        .email(email)
                        .isAllowed(true)
                        .registeredOrNot(true)
                        .userType(USER_TYPE_USER)
                        .build();
                authorizedUserRepository.save(row);
            });
        }
    }

    @Transactional
    public void seedAdminEmails(String adminEmailsCsv) {
        Set<String> adminEmails = parseEmailCsv(adminEmailsCsv);
        for (String email : adminEmails) {
            boolean alreadyRegistered = appUserRepository.existsByEmail(email);
            authorizedUserRepository.findByEmail(email).ifPresentOrElse(record -> {
                record.setIsAllowed(true);
                if (!USER_TYPE_OWNER.equals(normalizeRole(record.getUserType()))) {
                    record.setUserType(USER_TYPE_ADMIN);
                }
                if (alreadyRegistered) {
                    record.setRegisteredOrNot(true);
                }
                authorizedUserRepository.save(record);
            }, () -> {
                AuthorizedUser row = AuthorizedUser.builder()
                        .email(email)
                        .isAllowed(true)
                        .registeredOrNot(alreadyRegistered)
                        .userType(USER_TYPE_ADMIN)
                        .build();
                authorizedUserRepository.save(row);
            });
        }
    }

    private Set<String> parseEmailCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return Set.of();
        }

        return Arrays.stream(csv.split(","))
                .map(this::normalizeEmail)
                .filter(s -> !s.isBlank())
                .collect(Collectors.toSet());
    }

    private AuthorizedUser getAllowedRecordOrThrow(String email) {
        String normalized = normalizeEmail(email);
        AuthorizedUser authorizedUser = authorizedUserRepository.findByEmail(normalized)
                .orElseThrow(() -> new IllegalArgumentException("This email is not in the authorized users list."));

        if (!Boolean.TRUE.equals(authorizedUser.getIsAllowed())) {
            throw new IllegalArgumentException("This email is currently blocked from accessing the system.");
        }

        return authorizedUser;
    }

    private String normalizeRole(String role) {
        String normalized = role == null ? USER_TYPE_USER : role.trim().toLowerCase(Locale.ROOT);
        if (!Objects.equals(normalized, USER_TYPE_ADMIN)
                && !Objects.equals(normalized, USER_TYPE_OWNER)
                && !Objects.equals(normalized, USER_TYPE_USER)) {
            return USER_TYPE_USER;
        }
        return normalized;
    }

    private void appendAudit(String actorEmail, String targetEmail, String actionType, String details) {
        authorizedUserAuditLogRepository.save(AuthorizedUserAuditLog.builder()
                .actorEmail(normalizeEmail(actorEmail))
                .targetEmail(normalizeEmail(targetEmail))
                .actionType(actionType)
                .details(details)
                .build());
    }
}