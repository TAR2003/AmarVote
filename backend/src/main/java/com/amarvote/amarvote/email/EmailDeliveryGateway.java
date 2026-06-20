package com.amarvote.amarvote.email;

import org.springframework.stereotype.Component;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;

/**
 * Sends outbound email through the configured provider with rate limiting and
 * transient-failure retries so bulk traffic (thousands of recipients) does not
 * overwhelm Resend/SMTP or starve other application work.
 */
@Component
public class EmailDeliveryGateway {

    private static final String INSTANCE_NAME = "email";

    private final EmailSender emailSender;
    private final RateLimiter rateLimiter;
    private final Retry retry;

    public EmailDeliveryGateway(
            EmailSender emailSender,
            RateLimiterRegistry rateLimiterRegistry,
            RetryRegistry retryRegistry) {
        this.emailSender = emailSender;
        this.rateLimiter = rateLimiterRegistry.rateLimiter(INSTANCE_NAME);
        this.retry = retryRegistry.retry(INSTANCE_NAME);
    }

    public void deliver(EmailMessage message) {
        try {
            RateLimiter.decorateCallable(
                    rateLimiter,
                    Retry.decorateCallable(retry, () -> {
                        emailSender.send(message);
                        return null;
                    })).call();
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new RuntimeException("Email delivery failed", ex);
        }
    }
}
