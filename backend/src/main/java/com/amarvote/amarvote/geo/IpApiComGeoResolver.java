package com.amarvote.amarvote.geo;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Free ip-api.com resolver (HTTP, non-commercial).
 * Failures must NOT be cached long-term by the caching layer.
 */
@Component
public class IpApiComGeoResolver implements IpGeoResolver {

    private static final Logger log = LoggerFactory.getLogger(IpApiComGeoResolver.class);
    private static final String BATCH_URL =
            "http://ip-api.com/batch?fields=status,message,country,regionName,city,lat,lon,isp,org,query";
    private static final String SINGLE_URL =
            "http://ip-api.com/json/%s?fields=status,message,country,regionName,city,lat,lon,isp,org,query";
    private static final int BATCH_SIZE = 100;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    public IpApiComGeoResolver(RestTemplate restTemplate, ObjectMapper objectMapper) {
        this.restTemplate = restTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public GeoLocation resolve(String ip) {
        if (PrivateIpDetector.isPrivateOrReserved(ip)) {
            return GeoLocation.ofLocal();
        }
        try {
            String url = String.format(SINGLE_URL, ip.trim());
            ResponseEntity<String> response = restTemplate.getForEntity(url, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("ip-api single lookup HTTP {} for {}", response.getStatusCode(), ip);
                return GeoLocation.ofUnknown(ip);
            }
            return parseNode(objectMapper.readTree(response.getBody()), ip);
        } catch (Exception ex) {
            log.warn("ip-api single lookup failed for {}: {}", ip, ex.getMessage());
            return GeoLocation.ofUnknown(ip);
        }
    }

    @Override
    public Map<String, GeoLocation> resolveAll(Collection<String> ips) {
        Map<String, GeoLocation> results = new HashMap<>();
        List<String> toLookup = new ArrayList<>();

        for (String ip : ips) {
            if (ip == null || ip.isBlank()) {
                continue;
            }
            String trimmed = ip.trim();
            if (PrivateIpDetector.isPrivateOrReserved(trimmed)) {
                results.put(trimmed, GeoLocation.ofLocal());
            } else {
                toLookup.add(trimmed);
            }
        }

        for (int i = 0; i < toLookup.size(); i += BATCH_SIZE) {
            List<String> chunk = toLookup.subList(i, Math.min(i + BATCH_SIZE, toLookup.size()));
            results.putAll(resolveBatch(chunk));
            if (i + BATCH_SIZE < toLookup.size()) {
                try {
                    Thread.sleep(1600L);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        return results;
    }

    private Map<String, GeoLocation> resolveBatch(List<String> ips) {
        Map<String, GeoLocation> results = new HashMap<>();
        if (ips.isEmpty()) {
            return results;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<List<String>> entity = new HttpEntity<>(ips, headers);
            ResponseEntity<String> response = restTemplate.postForEntity(BATCH_URL, entity, String.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                log.warn("ip-api batch HTTP {} for {} IPs", response.getStatusCode(), ips.size());
                return results;
            }
            JsonNode array = objectMapper.readTree(response.getBody());
            if (array.isArray()) {
                for (JsonNode node : array) {
                    String query = text(node, "query");
                    if (query == null || query.isBlank()) {
                        continue;
                    }
                    results.put(query.trim(), parseNode(node, query));
                }
            }
        } catch (Exception ex) {
            log.warn("ip-api batch lookup failed ({} IPs): {}", ips.size(), ex.getMessage());
        }
        return results;
    }

    private GeoLocation parseNode(JsonNode node, String fallbackIp) {
        String status = text(node, "status");
        if (!"success".equalsIgnoreCase(status)) {
            String message = text(node, "message");
            log.warn("ip-api miss for {}: status={}, message={}", fallbackIp, status, message);
            return GeoLocation.ofUnknown(fallbackIp);
        }
        Double lat = node.has("lat") && !node.get("lat").isNull() ? node.get("lat").asDouble() : null;
        Double lon = node.has("lon") && !node.get("lon").isNull() ? node.get("lon").asDouble() : null;
        String city = firstNonBlank(text(node, "city"), text(node, "regionName"), "Unknown");
        String country = firstNonBlank(text(node, "country"), "Unknown");
        String region = text(node, "regionName");
        String isp = firstNonBlank(text(node, "isp"), text(node, "org"));
        return new GeoLocation(lat, lon, city, country, region, isp, false);
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
