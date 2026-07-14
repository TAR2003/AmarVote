package com.amarvote.amarvote.geo;

/**
 * Resolved geographic coordinates for an IP.
 * Private/reserved IPs use {@link #ofLocal()} and must not be plotted on the globe.
 */
public record GeoLocation(
        Double lat,
        Double lon,
        String city,
        String country,
        boolean local) {

    public static GeoLocation ofLocal() {
        return new GeoLocation(null, null, "Local / Internal", "Local / Internal", true);
    }

    public static GeoLocation ofUnknown(String ip) {
        return new GeoLocation(null, null, "Unknown", "Unknown", false);
    }

    public boolean isPlottable() {
        return !local && lat != null && lon != null;
    }
}
