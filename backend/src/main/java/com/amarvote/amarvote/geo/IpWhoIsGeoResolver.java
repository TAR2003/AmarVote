package com.amarvote.amarvote.geo;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * HTTPS fallback geo resolver (ipwho.is — free, no key).
 * Used when ip-api.com fails, rate-limits, or is unreachable from the server.
 */
@Component
public class IpWhoIsGeoResolver implements IpGeoResolver {

    private static final Logger log = LoggerFactory.getLogger(IpWhoIsGeoResolver.class);
    private static final String SINGLE_URL = "https://ipwho.is/%s";

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public IpWhoIsGeoResolver(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public GeoLocation resolve(String ip) {
        if (PrivateIpDetector.isPrivateOrReserved(ip)) {
            return GeoLocation.ofLocal();
        }
        return lookup(ip.trim());
    }

    @Override
    public Map<String, GeoLocation> resolveAll(Collection<String> ips) {
        Map<String, GeoLocation> results = new HashMap<>();
        List<String> list = new ArrayList<>();
        for (String ip : ips) {
            if (ip == null || ip.isBlank()) {
                continue;
            }
            String trimmed = ip.trim();
            if (PrivateIpDetector.isPrivateOrReserved(trimmed)) {
                results.put(trimmed, GeoLocation.ofLocal());
            } else {
                list.add(trimmed);
            }
        }

        for (int i = 0; i < list.size(); i++) {
            String ip = list.get(i);
            results.put(ip, lookup(ip));
            // Be polite to free HTTPS endpoint
            if (i + 1 < list.size()) {
                try {
                    Thread.sleep(120L);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return results;
    }

    private GeoLocation lookup(String ip) {
        try {
            ResponseEntity<String> response = restTemplate.getForEntity(String.format(SINGLE_URL, ip), String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("ipwho.is HTTP {} for {}", response.getStatusCode(), ip);
                return GeoLocation.ofUnknown(ip);
            }
            JsonNode node = objectMapper.readTree(response.getBody());
            boolean success = node.has("success") && node.get("success").asBoolean(false);
            if (!success) {
                log.warn("ipwho.is miss for {}: {}", ip, text(node, "message"));
                return GeoLocation.ofUnknown(ip);
            }
            Double lat = node.has("latitude") && !node.get("latitude").isNull()
                    ? node.get("latitude").asDouble() : null;
            Double lon = node.has("longitude") && !node.get("longitude").isNull()
                    ? node.get("longitude").asDouble() : null;
            String city = firstNonBlank(text(node, "city"), text(node, "region"), "Unknown");
            String country = firstNonBlank(text(node, "country"), "Unknown");
            String region = text(node, "region");
            String isp = null;
            if (node.has("connection") && node.get("connection").isObject()) {
                JsonNode conn = node.get("connection");
                isp = firstNonBlank(text(conn, "isp"), text(conn, "org"));
            }
            return new GeoLocation(lat, lon, city, country, region, isp, false);
        } catch (Exception ex) {
            log.warn("ipwho.is lookup failed for {}: {}", ip, ex.getMessage());
            return GeoLocation.ofUnknown(ip);
        }
    }

    private static String firstNonBlank(String... values) {
        if (values == null) {
            return null;
        }
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.has(field) || node.get(field).isNull()) {
            return null;
        }
        return node.get(field).asText();
    }
}
