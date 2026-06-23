package com.amarvote.amarvote.util;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the originating client IP behind reverse proxies (nginx) and Cloudflare.
 */
public final class ClientIpUtil {

    private static final String[] IP_HEADERS = {
        "CF-Connecting-IP",
        "True-Client-IP",
        "X-Forwarded-For",
        "X-Real-IP",
    };

    private ClientIpUtil() {
    }

    public static String resolve(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        for (String header : IP_HEADERS) {
            String value = request.getHeader(header);
            String ip = firstValidIp(value);
            if (ip != null) {
                return ip;
            }
        }

        String remoteAddr = request.getRemoteAddr();
        return isBlank(remoteAddr) ? null : remoteAddr.trim();
    }

    private static String firstValidIp(String headerValue) {
        if (isBlank(headerValue) || "unknown".equalsIgnoreCase(headerValue.trim())) {
            return null;
        }

        for (String part : headerValue.split(",")) {
            String candidate = normalizeIp(part);
            if (candidate != null) {
                return candidate;
            }
        }

        return null;
    }

    private static String normalizeIp(String rawIp) {
        if (isBlank(rawIp)) {
            return null;
        }

        String ip = rawIp.trim();
        if (ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            return null;
        }

        // IPv4 with optional port: 203.0.113.5:12345
        if (ip.chars().filter(ch -> ch == ':').count() == 1 && ip.contains(".")) {
            ip = ip.substring(0, ip.indexOf(':'));
        }

        // Bracketed IPv6: [::1]
        if (ip.startsWith("[") && ip.contains("]")) {
            ip = ip.substring(1, ip.indexOf(']'));
        }

        return ip.isEmpty() ? null : ip;
    }

    private static boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
