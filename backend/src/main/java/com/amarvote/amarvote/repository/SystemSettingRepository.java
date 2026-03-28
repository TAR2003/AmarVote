package com.amarvote.amarvote.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.amarvote.amarvote.model.SystemSetting;

public interface SystemSettingRepository extends JpaRepository<SystemSetting, String> {
}