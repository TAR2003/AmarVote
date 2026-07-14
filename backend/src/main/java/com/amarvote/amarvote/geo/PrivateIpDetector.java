package com.amarvote.amarvote.geo;

import java.net.InetAddress;
import java.net.UnknownHostException;

/**
 * Detects private, loopback, link-local, and other non-routable addresses.
 */
public final class PrivateIpDetector {

    private PrivateIpDetector() {
    }

    public static boolean isPrivateOrReserved(String ip) {
        if (ip == null || ip.isBlank()) {
            return true;
        }
        String trimmed = ip.trim();
        if ("unknown".equalsIgnoreCase(trimmed)
                || "localhost".equalsIgnoreCase(trimmed)
                || "::1".equals(trimmed)
                || "0:0:0:0:0:0:0:1".equals(trimmed)) {
            return true;
        }

        // Strip IPv4-mapped IPv6 prefix
        if (trimmed.startsWith("::ffff:")) {
            trimmed = trimmed.substring(7);
        }

        try {
            InetAddress address = InetAddress.getByName(trimmed);
            return address.isAnyLocalAddress()
                    || address.isLoopbackAddress()
                    || address.isLinkLocalAddress()
                    || address.isSiteLocalAddress()
                    || address.isMulticastAddress();
        } catch (UnknownHostException ex) {
            // Malformed — treat as non-plottable local bucket
            return true;
        }
    }
}
