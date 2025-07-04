package com.amarvote.amarvote.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Utility class for handling timezone conversions and date/time operations
 */
public class DateTimeUtil {
    
    public static final String DEFAULT_TIMEZONE = "Asia/Dhaka"; // Bangladesh Standard Time
    public static final ZoneId UTC_ZONE = ZoneId.of("UTC");
    public static final ZoneId BST_ZONE = ZoneId.of(DEFAULT_TIMEZONE);
    
    /**
     * Convert an Instant (stored in UTC) to local time for display
     * @param utcInstant The UTC instant from database
     * @param targetZone The target timezone for conversion
     * @return ZonedDateTime in target timezone
     */
    public static ZonedDateTime toLocalTime(Instant utcInstant, String targetZone) {
        if (utcInstant == null) return null;
        return utcInstant.atZone(ZoneId.of(targetZone));
    }
    
    /**
     * Convert an Instant (stored in UTC) to Bangladesh Standard Time for display
     * @param utcInstant The UTC instant from database
     * @return ZonedDateTime in BST
     */
    public static ZonedDateTime toBST(Instant utcInstant) {
        if (utcInstant == null) return null;
        return utcInstant.atZone(BST_ZONE);
    }
    
    /**
     * Convert local time string to UTC Instant for database storage
     * @param localDateTime The local date time string
     * @param timezone The timezone of the input
     * @return Instant in UTC
     */
    public static Instant toUTCInstant(String localDateTime, String timezone) {
        DateTimeFormatter formatter = DateTimeFormatter.ISO_LOCAL_DATE_TIME;
        LocalDateTime dateTime = LocalDateTime.parse(localDateTime, formatter);
        return dateTime.atZone(ZoneId.of(timezone)).toInstant();
    }
    
    /**
     * Convert local time from BST to UTC Instant for database storage
     * @param localDateTime The local date time in BST
     * @return Instant in UTC
     */
    public static Instant fromBSTToUTC(LocalDateTime localDateTime) {
        if (localDateTime == null) return null;
        return localDateTime.atZone(BST_ZONE).toInstant();
    }
    
    /**
     * Get current time in UTC
     * @return Current UTC instant
     */
    public static Instant nowUTC() {
        return Instant.now();
    }
    
    /**
     * Get current time in BST
     * @return Current time in Bangladesh timezone
     */
    public static ZonedDateTime nowBST() {
        return ZonedDateTime.now(BST_ZONE);
    }
    
    /**
     * Check if an election is currently active based on UTC time
     * @param startTime UTC start time
     * @param endTime UTC end time
     * @return true if current UTC time is between start and end
     */
    public static boolean isElectionActive(Instant startTime, Instant endTime) {
        Instant now = nowUTC();
        return now.isAfter(startTime) && now.isBefore(endTime);
    }
    
    /**
     * Format an Instant for display in a specific timezone
     * @param instant The UTC instant
     * @param timezone The timezone for display
     * @param pattern The format pattern
     * @return Formatted date string
     */
    public static String formatForDisplay(Instant instant, String timezone, String pattern) {
        if (instant == null) return "";
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern(pattern);
        return instant.atZone(ZoneId.of(timezone)).format(formatter);
    }
    
    /**
     * Format an Instant for display in BST
     * @param instant The UTC instant
     * @param pattern The format pattern
     * @return Formatted date string in BST
     */
    public static String formatForBST(Instant instant, String pattern) {
        return formatForDisplay(instant, DEFAULT_TIMEZONE, pattern);
    }
}
