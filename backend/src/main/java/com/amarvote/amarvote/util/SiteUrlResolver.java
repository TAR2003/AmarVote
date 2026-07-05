package com.amarvote.amarvote.util;

import java.net.URI;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import jakarta.servlet.http.HttpServletRequest;

/**
 * Resolves the public site base URL (scheme + host, no trailing slash) for links in emails.
 * Prefers the incoming HTTP request (Origin / forwarded headers) so links match the site the user is on.
 * Falls back to {@code PUBLIC_BASE_URL} when no request context is available.
 */
@Component
public class SiteUrlResolver {

    @Value("${amarvote.public.base-url:}")
    private String configuredBaseUrl;

    public String resolve(HttpServletRequest request) {
        String fromRequest = resolveFromRequest(request);
        if (fromRequest != null) {
            return fromRequest;
        }
        return getConfiguredBaseUrl();
    }

    public String getConfiguredBaseUrl() {
        return normalize(configuredBaseUrl);
    }

    private String resolveFromRequest(HttpServletRequest request) {
        if (request == null) {
            return null;
        }

        String origin = request.getHeader("Origin");
        if (isUsableBaseUrl(origin)) {
            return normalize(origin);
        }

        String forwardedHost = firstHeaderValue(request, "X-Forwarded-Host");
        if (forwardedHost != null) {
            String proto = firstHeaderValue(request, "X-Forwarded-Proto");
            if (proto == null || proto.isBlank()) {
                proto = request.getScheme();
            }
            return normalize(proto + "://" + forwardedHost);
        }

        String referer = request.getHeader("Referer");
        String fromReferer = extractOrigin(referer);
        if (fromReferer != null) {
            return fromReferer;
        }

        String serverName = request.getServerName();
        if (serverName != null && !serverName.isBlank()) {
            String scheme = request.getScheme();
            int port = request.getServerPort();
            StringBuilder url = new StringBuilder().append(scheme).append("://").append(serverName);
            if (port > 0
                    && !("http".equalsIgnoreCase(scheme) && port == 80)
                    && !("https".equalsIgnoreCase(scheme) && port == 443)) {
                url.append(":").append(port);
            }
            return normalize(url.toString());
        }

        return null;
    }

    private static String extractOrigin(String referer) {
        if (referer == null || referer.isBlank()) {
            return null;
        }
        try {
            URI uri = URI.create(referer.trim());
            if (uri.getScheme() == null || uri.getHost() == null) {
                return null;
            }
            StringBuilder origin = new StringBuilder().append(uri.getScheme()).append("://").append(uri.getHost());
            int port = uri.getPort();
            if (port > 0
                    && !("http".equalsIgnoreCase(uri.getScheme()) && port == 80)
                    && !("https".equalsIgnoreCase(uri.getScheme()) && port == 443)) {
                origin.append(":").append(port);
            }
            return normalize(origin.toString());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String firstHeaderValue(HttpServletRequest request, String headerName) {
        String value = request.getHeader(headerName);
        if (value == null || value.isBlank() || "unknown".equalsIgnoreCase(value.trim())) {
            return null;
        }
        return value.split(",")[0].trim();
    }

    private static boolean isUsableBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            URI uri = URI.create(value.trim());
            return uri.getScheme() != null && uri.getHost() != null;
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

    private static String normalize(String url) {
        if (url == null || url.isBlank()) {
            return null;
        }
        return url.trim().replaceAll("/+$", "");
    }
}
