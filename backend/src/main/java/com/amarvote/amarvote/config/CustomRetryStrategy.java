package com.amarvote.amarvote.config;

import java.io.IOException;
import java.net.ConnectException;
import java.net.SocketTimeoutException;

import org.apache.hc.client5.http.impl.DefaultHttpRequestRetryStrategy;
import org.apache.hc.core5.http.HttpRequest;
import org.apache.hc.core5.http.HttpResponse;
import org.apache.hc.core5.http.protocol.HttpContext;
import org.apache.hc.core5.util.TimeValue;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class CustomRetryStrategy extends DefaultHttpRequestRetryStrategy {
    
    private static final Logger log = LoggerFactory.getLogger(CustomRetryStrategy.class);
    private final long retryDelayMs;
    private final int maxRetries;

    public CustomRetryStrategy(int maxRetries, long retryDelayMs) {
        super(maxRetries, TimeValue.ofMilliseconds(retryDelayMs));
        this.retryDelayMs = retryDelayMs;
        this.maxRetries = maxRetries;
    }

    @Override
    public boolean retryRequest(
            HttpRequest request,
            IOException exception,
            int execCount,
            HttpContext context) {
        
        // Log retry attempts
        log.warn("Request failed (attempt {}/{}): {}", 
            execCount, maxRetries, exception.getMessage());

        // Retry on connection refused or timeout
        if (exception instanceof ConnectException || 
            exception instanceof SocketTimeoutException) {
            if (execCount <= maxRetries) {
                log.info("Retrying request after {}ms...", retryDelayMs * execCount);
                return true;
            }
        }

        return super.retryRequest(request, exception, execCount, context);
    }

    @Override
    public boolean retryRequest(
            HttpResponse response,
            int execCount,
            HttpContext context) {
        
        int statusCode = response.getCode();
        
        // Retry on 503 Service Unavailable or 429 Too Many Requests
        if ((statusCode == 503 || statusCode == 429) && execCount <= maxRetries) {
            log.warn("Received status {} (attempt {}/{}), retrying...", 
                statusCode, execCount, maxRetries);
            return true;
        }

        return super.retryRequest(response, execCount, context);
    }
}
