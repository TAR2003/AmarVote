package com.amarvote.amarvote.email;

import java.util.List;

import org.springframework.stereotype.Component;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;

/**
 * Sends outbound email through the configured provider with API-call rate limiting
 * and transient-failure retries. Resend allows 5 API requests/second; batch calls
 * can include up to 100 emails each.
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

    /** One Resend API call for a single email. */
    public void deliver(EmailMessage message) {
        executeWithResilience(() -> {
            emailSender.send(message);
            return null;
        });
    }

    /** One Resend API call for up to 100 emails via the batch endpoint. */
    public void deliverBatch(List<EmailMessage> messages) {
        if (messages == null || messages.isEmpty()) {
            return;
        }
        executeWithResilience(() -> {
            emailSender.sendBatch(messages);
            return null;
        });
    }

    private void executeWithResilience(java.util.concurrent.Callable<Void> action) {
        try {
            RateLimiter.decorateCallable(
                    rateLimiter,
                    Retry.decorateCallable(retry, action)).call();
        } catch (RuntimeException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new RuntimeException("Email delivery failed", ex);
        }
    }
}
