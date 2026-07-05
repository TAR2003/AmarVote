package com.amarvote.amarvote.email;

import java.util.regex.Pattern;

import org.springframework.stereotype.Component;

/**
 * Strict email validation before messages enter a Resend batch pool.
 * Invalid addresses are rejected so one malformed recipient cannot fail an entire batch.
 */
@Component
public class EmailAddressValidator {

  /**
   * Practical RFC-inspired pattern: local@domain.tld with no consecutive dots,
   * no leading/trailing dots in local or domain parts.
   */
  private static final Pattern STRICT_EMAIL =
      Pattern.compile(
          "^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?"
              + "@"
              + "(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+"
              + "[a-zA-Z]{2,63}$");

  public boolean isValid(String email) {
    if (email == null) {
      return false;
    }
    String normalized = email.trim();
    if (normalized.isEmpty() || normalized.length() > 254) {
      return false;
    }
    if (normalized.contains("..") || normalized.startsWith(".") || normalized.endsWith(".")) {
      return false;
    }
    int at = normalized.indexOf('@');
    if (at <= 0 || at == normalized.length() - 1) {
      return false;
    }
    return STRICT_EMAIL.matcher(normalized).matches();
  }

  public String normalize(String email) {
    if (email == null) {
      return null;
    }
    return email.trim().toLowerCase();
  }
}
