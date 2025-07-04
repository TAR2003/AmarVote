package com.amarvote.amarvote.config;

import java.util.TimeZone;

import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

/**
 * Configuration class to set the default timezone for the application
 * This ensures consistent timezone handling across all operations
 */
@Configuration
public class TimeZoneConfig {
    
    @PostConstruct
    public void init() {
        // Set the default timezone to UTC for the entire application
        TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
        System.out.println("Application timezone set to: " + TimeZone.getDefault().getID());
    }
}
