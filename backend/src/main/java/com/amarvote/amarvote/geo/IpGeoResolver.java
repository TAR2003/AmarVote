package com.amarvote.amarvote.geo;

import java.util.Collection;
import java.util.Map;

/**
 * Swappable IP → geo lookup. Implementations: ip-api.com now, MaxMind GeoLite2 later.
 */
public interface IpGeoResolver {

    GeoLocation resolve(String ip);

    /**
     * Resolve many IPs efficiently (batch where supported). Missing entries are omitted.
     */
    Map<String, GeoLocation> resolveAll(Collection<String> ips);
}
