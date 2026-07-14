package com.amarvote.amarvote.geo;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Component;

import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * Redis + in-memory LRU cache over {@link CascadingIpGeoResolver}.
 * <p>
 * Only successful / local resolutions are cached long-term. Failed "Unknown"
 * responses are never persisted for 30 days — that was causing IPs like
 * 103.121.62.80 to stick as Unknown after a temporary rate-limit or HTTP failure.
 */
@Component
@Primary
public class CachingIpGeoResolver implements IpGeoResolver {

    private static final Logger log = LoggerFactory.getLogger(CachingIpGeoResolver.class);
    /** Bumped to invalidate stale Unknown entries written by the first release. */
    private static final String KEY_PREFIX = "analytics:geo:v2:";
    private static final Duration SUCCESS_TTL = Duration.ofDays(30);
    private static final int LRU_CAPACITY = 4000;

    private final CascadingIpGeoResolver delegate;
    private final RedisTemplate<String, String> redisTemplate;
    private final ObjectMapper objectMapper;
    private final Map<String, GeoLocation> lru = Collections.synchronizedMap(
            new LinkedHashMap<>(512, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, GeoLocation> eldest) {
                    return size() > LRU_CAPACITY;
                }
            });

    public CachingIpGeoResolver(
            CascadingIpGeoResolver delegate,
            RedisTemplate<String, String> redisTemplate,
            ObjectMapper objectMapper) {
        this.delegate = delegate;
        this.redisTemplate = redisTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public GeoLocation resolve(String ip) {
        if (ip == null || ip.isBlank()) {
            return GeoLocation.ofLocal();
        }
        String trimmed = ip.trim();
        if (PrivateIpDetector.isPrivateOrReserved(trimmed)) {
            return GeoLocation.ofLocal();
        }

        GeoLocation cached = getCached(trimmed);
        if (cached != null && cached.isCacheableSuccess()) {
            return cached;
        }

        GeoLocation resolved = delegate.resolve(trimmed);
        putCached(trimmed, resolved);
        return resolved;
    }

    @Override
    public Map<String, GeoLocation> resolveAll(Collection<String> ips) {
        Map<String, GeoLocation> results = new HashMap<>();
        List<String> misses = new ArrayList<>();

        for (String ip : ips) {
            if (ip == null || ip.isBlank()) {
                continue;
            }
            String trimmed = ip.trim();
            if (PrivateIpDetector.isPrivateOrReserved(trimmed)) {
                results.put(trimmed, GeoLocation.ofLocal());
                continue;
            }
            GeoLocation cached = getCached(trimmed);
            if (cached != null && cached.isCacheableSuccess()) {
                results.put(trimmed, cached);
            } else {
                misses.add(trimmed);
            }
        }

        if (!misses.isEmpty()) {
            Map<String, GeoLocation> freshlyResolved = delegate.resolveAll(misses);
            for (Map.Entry<String, GeoLocation> entry : freshlyResolved.entrySet()) {
                putCached(entry.getKey(), entry.getValue());
                results.put(entry.getKey(), entry.getValue());
            }
        }
        return results;
    }

    private GeoLocation getCached(String ip) {
        GeoLocation memory = lru.get(ip);
        if (memory != null && memory.isCacheableSuccess()) {
            return memory;
        }
        try {
            String json = redisTemplate.opsForValue().get(KEY_PREFIX + ip);
            if (json != null && !json.isBlank()) {
                CachedGeo dto = objectMapper.readValue(json, CachedGeo.class);
                GeoLocation location = dto.toGeoLocation();
                if (location.isCacheableSuccess()) {
                    lru.put(ip, location);
                    return location;
                }
                // Drop bad legacy cache entries
                redisTemplate.delete(KEY_PREFIX + ip);
            }
        } catch (Exception ex) {
            log.debug("Redis geo cache read miss for {}: {}", ip, ex.getMessage());
        }
        return null;
    }

    private void putCached(String ip, GeoLocation location) {
        if (location == null || !location.isCacheableSuccess()) {
            return;
        }
        lru.put(ip, location);
        try {
            String json = objectMapper.writeValueAsString(CachedGeo.from(location));
            redisTemplate.opsForValue().set(KEY_PREFIX + ip, json, SUCCESS_TTL);
        } catch (Exception ex) {
            log.debug("Redis geo cache write failed for {}: {}", ip, ex.getMessage());
        }
    }

    private record CachedGeo(
            Double lat,
            Double lon,
            String city,
            String country,
            String region,
            String isp,
            boolean local) {
        static CachedGeo from(GeoLocation g) {
            return new CachedGeo(g.lat(), g.lon(), g.city(), g.country(), g.region(), g.isp(), g.local());
        }

        GeoLocation toGeoLocation() {
            return new GeoLocation(lat, lon, city, country, region, isp, local);
        }
    }
}
