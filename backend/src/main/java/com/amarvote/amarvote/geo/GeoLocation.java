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
        String region,
        String isp,
        boolean local) {

    public static GeoLocation ofLocal() {
        return new GeoLocation(null, null, "Local / Internal", "Local / Internal", null, null, true);
    }

    public static GeoLocation ofUnknown(String ip) {
        return new GeoLocation(null, null, "Unknown", "Unknown", null, null, false);
    }

    public boolean isPlottable() {
        return !local && lat != null && lon != null
                && Double.isFinite(lat) && Double.isFinite(lon);
    }

    /** True when this is a lasting geo hit worth keeping in Redis. */
    public boolean isCacheableSuccess() {
        return local || isPlottable();
    }
}
