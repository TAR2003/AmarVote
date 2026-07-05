package com.amarvote.amarvote.email;

/**
 * Wraps provider failures with hints for retry and batch-recovery logic.
 */
public class EmailDeliveryException extends RuntimeException {

  private final boolean rateLimited;

  public EmailDeliveryException(String message, Throwable cause, boolean rateLimited) {
    super(message, cause);
    this.rateLimited = rateLimited;
  }

  public boolean isRateLimited() {
    return rateLimited;
  }

  public static EmailDeliveryException wrap(Throwable cause) {
    boolean rateLimited = isRateLimitSignal(cause);
    String message =
        cause == null ? "Email delivery failed" : cause.getMessage();
    return new EmailDeliveryException(message, cause, rateLimited);
  }

  public static boolean isRateLimitSignal(Throwable throwable) {
    Throwable current = throwable;
    while (current != null) {
      String message = current.getMessage();
      if (message != null) {
        String lower = message.toLowerCase();
        if (lower.contains("429")
            || lower.contains("rate limit")
            || lower.contains("too many requests")) {
          return true;
        }
      }
      current = current.getCause();
    }
    return false;
  }
}
