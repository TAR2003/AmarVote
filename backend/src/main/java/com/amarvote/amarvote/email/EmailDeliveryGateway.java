package com.amarvote.amarvote.email;

import java.util.List;

import org.springframework.stereotype.Component;

import io.github.resilience4j.ratelimiter.RateLimiter;
import io.github.resilience4j.ratelimiter.RateLimiterRegistry;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryRegistry;

/**
 * Sends outbound email through the configured provider with per-lane rate limiting
 * (1 API request/second each) and exponential backoff on transient failures including 429.
 */
@Component
public class EmailDeliveryGateway {

  private static final String TRANSACTIONAL_INSTANCE = "email-transactional";
  private static final String BULK_INSTANCE = "email-bulk";

  private final EmailSender emailSender;
  private final RateLimiter transactionalRateLimiter;
  private final RateLimiter bulkRateLimiter;
  private final Retry transactionalRetry;
  private final Retry bulkRetry;

  public EmailDeliveryGateway(
      EmailSender emailSender,
      RateLimiterRegistry rateLimiterRegistry,
      RetryRegistry retryRegistry) {
    this.emailSender = emailSender;
    this.transactionalRateLimiter = rateLimiterRegistry.rateLimiter(TRANSACTIONAL_INSTANCE);
    this.bulkRateLimiter = rateLimiterRegistry.rateLimiter(BULK_INSTANCE);
    this.transactionalRetry = retryRegistry.retry(TRANSACTIONAL_INSTANCE);
    this.bulkRetry = retryRegistry.retry(BULK_INSTANCE);
  }

  public void deliver(EmailQueueType queueType, EmailMessage message) {
    executeWithResilience(queueType, () -> {
      emailSender.send(message);
      return null;
    });
  }

  public void deliverBatch(EmailQueueType queueType, List<EmailMessage> messages) {
    if (messages == null || messages.isEmpty()) {
      return;
    }
    // SMTP (and any non-Resend provider) has no true batch API — rate-limit each send.
    if (!"resend".equalsIgnoreCase(emailSender.providerId())) {
      for (EmailMessage message : messages) {
        deliver(queueType, message);
      }
      return;
    }
    executeWithResilience(queueType, () -> {
      emailSender.sendBatch(messages);
      return null;
    });
  }

  /** @deprecated Use {@link #deliver(EmailQueueType, EmailMessage)} */
  @Deprecated
  public void deliver(EmailMessage message) {
    deliver(EmailQueueType.TRANSACTIONAL, message);
  }

  /** @deprecated Use {@link #deliverBatch(EmailQueueType, List)} */
  @Deprecated
  public void deliverBatch(List<EmailMessage> messages) {
    deliverBatch(EmailQueueType.TRANSACTIONAL, messages);
  }

  private void executeWithResilience(EmailQueueType queueType, java.util.concurrent.Callable<Void> action) {
    RateLimiter rateLimiter =
        queueType == EmailQueueType.BULK ? bulkRateLimiter : transactionalRateLimiter;
    Retry retry = queueType == EmailQueueType.BULK ? bulkRetry : transactionalRetry;

    try {
      RateLimiter.decorateCallable(rateLimiter, Retry.decorateCallable(retry, action)).call();
    } catch (RuntimeException ex) {
      throw ex instanceof EmailDeliveryException
          ? ex
          : EmailDeliveryException.wrap(ex);
    } catch (Exception ex) {
      throw EmailDeliveryException.wrap(ex);
    }
  }
}
