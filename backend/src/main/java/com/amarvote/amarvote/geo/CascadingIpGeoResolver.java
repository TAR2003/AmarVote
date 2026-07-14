package com.amarvote.amarvote.geo;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Tries ip-api.com first, then ipwho.is for any IP that still lacks coordinates.
 */
@Component
public class CascadingIpGeoResolver implements IpGeoResolver {

    private static final Logger log = LoggerFactory.getLogger(CascadingIpGeoResolver.class);

    private final IpApiComGeoResolver primary;
    private final IpWhoIsGeoResolver fallback;

    public CascadingIpGeoResolver(IpApiComGeoResolver primary, IpWhoIsGeoResolver fallback) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public GeoLocation resolve(String ip) {
        if (PrivateIpDetector.isPrivateOrReserved(ip)) {
            return GeoLocation.ofLocal();
        }
        GeoLocation first = primary.resolve(ip);
        if (first.isCacheableSuccess()) {
            return first;
        }
        log.info("Cascading geo fallback for {}", ip);
        GeoLocation second = fallback.resolve(ip);
        return second.isCacheableSuccess() ? second : first;
    }

    @Override
    public Map<String, GeoLocation> resolveAll(Collection<String> ips) {
        Map<String, GeoLocation> primaryHits = primary.resolveAll(ips);
        Map<String, GeoLocation> results = new HashMap<>(primaryHits);

        List<String> needFallback = new ArrayList<>();
        for (String ip : ips) {
            if (ip == null || ip.isBlank()) {
                continue;
            }
            String trimmed = ip.trim();
            GeoLocation hit = results.get(trimmed);
            if (hit == null || !hit.isCacheableSuccess()) {
                if (!PrivateIpDetector.isPrivateOrReserved(trimmed)) {
                    needFallback.add(trimmed);
                }
            }
        }

        if (!needFallback.isEmpty()) {
            log.info("Cascading geo fallback for {} IPs", needFallback.size());
            Map<String, GeoLocation> secondary = fallback.resolveAll(needFallback);
            for (Map.Entry<String, GeoLocation> entry : secondary.entrySet()) {
                if (entry.getValue().isCacheableSuccess()) {
                    results.put(entry.getKey(), entry.getValue());
                } else {
                    results.putIfAbsent(entry.getKey(), entry.getValue());
                }
            }
        }

        for (String ip : ips) {
            if (ip == null || ip.isBlank()) {
                continue;
            }
            results.putIfAbsent(ip.trim(), GeoLocation.ofUnknown(ip.trim()));
        }
        return results;
    }
}
