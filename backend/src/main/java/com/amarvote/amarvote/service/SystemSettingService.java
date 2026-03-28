package com.amarvote.amarvote.service;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amarvote.amarvote.model.SystemSetting;
import com.amarvote.amarvote.repository.SystemSettingRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SystemSettingService {

    public static final String REGISTRATION_OPEN_TO_ALL = "REGISTRATION_OPEN_TO_ALL";
    public static final String ELECTION_CREATION_PERMISSION_SCOPE = "ELECTION_CREATION_PERMISSION_SCOPE";

    public static final String SCOPE_ALL_USERS = "all_users";
    public static final String SCOPE_ALL_AUTHENTICATED_USERS = "all_authenticated_users";
    public static final String SCOPE_ALL_ADMINS_OWNERS = "all_admins_owners";
    public static final String SCOPE_OWNER = "owner";

    private final SystemSettingRepository systemSettingRepository;

    @Transactional
    public void ensureDefaults() {
        upsertIfMissing(REGISTRATION_OPEN_TO_ALL, "false",
                "If true, anyone can sign up/login. If false, only authorized_users table is allowed.");
        upsertIfMissing(ELECTION_CREATION_PERMISSION_SCOPE, SCOPE_ALL_ADMINS_OWNERS,
                "Scope for creating elections: all_users, all_authenticated_users, all_admins_owners, owner");
    }

    @Transactional(readOnly = true)
    public boolean isRegistrationOpenToAll() {
        return Boolean.parseBoolean(getValue(REGISTRATION_OPEN_TO_ALL, "false"));
    }

    @Transactional(readOnly = true)
    public String getElectionCreationPermissionScope() {
        String value = getValue(ELECTION_CREATION_PERMISSION_SCOPE, SCOPE_ALL_ADMINS_OWNERS).trim().toLowerCase();
        if (!value.equals(SCOPE_ALL_USERS)
                && !value.equals(SCOPE_ALL_AUTHENTICATED_USERS)
                && !value.equals(SCOPE_ALL_ADMINS_OWNERS)
                && !value.equals(SCOPE_OWNER)) {
            return SCOPE_ALL_ADMINS_OWNERS;
        }
        return value;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getSettingsForUi() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("registrationOpenToAll", isRegistrationOpenToAll());
        response.put("electionCreationPermissionScope", getElectionCreationPermissionScope());
        return response;
    }

    @Transactional
    public Map<String, Object> updateSettings(Boolean registrationOpenToAll, String electionCreationPermissionScope) {
        if (registrationOpenToAll != null) {
            upsert(REGISTRATION_OPEN_TO_ALL, String.valueOf(registrationOpenToAll),
                    "If true, anyone can sign up/login. If false, only authorized_users table is allowed.");
        }

        if (electionCreationPermissionScope != null && !electionCreationPermissionScope.isBlank()) {
            String normalized = electionCreationPermissionScope.trim().toLowerCase();
            if (!normalized.equals(SCOPE_ALL_USERS)
                    && !normalized.equals(SCOPE_ALL_AUTHENTICATED_USERS)
                    && !normalized.equals(SCOPE_ALL_ADMINS_OWNERS)
                    && !normalized.equals(SCOPE_OWNER)) {
                throw new IllegalArgumentException("Invalid election creation scope.");
            }

            upsert(ELECTION_CREATION_PERMISSION_SCOPE, normalized,
                    "Scope for creating elections: all_users, all_authenticated_users, all_admins_owners, owner");
        }

        return getSettingsForUi();
    }

    private String getValue(String key, String defaultValue) {
        return systemSettingRepository.findById(key)
                .map(SystemSetting::getSettingValue)
                .orElse(defaultValue);
    }

    private void upsertIfMissing(String key, String value, String description) {
        if (!systemSettingRepository.existsById(key)) {
            upsert(key, value, description);
        }
    }

    private void upsert(String key, String value, String description) {
        systemSettingRepository.save(SystemSetting.builder()
                .settingKey(key)
                .settingValue(value)
                .description(description)
                .build());
    }
}