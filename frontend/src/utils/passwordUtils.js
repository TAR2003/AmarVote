/**
 * Client-side password validation matching backend MfaAuthService rules.
 */
export function getPasswordValidationErrors(password) {
  const errors = [];
  if (!password) {
    return ['Password is required'];
  }
  if (password.length < 12) {
    errors.push('at least 12 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('a lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('an uppercase letter');
  }
  if (!/\d/.test(password)) {
    errors.push('a digit');
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('a special character');
  }
  return errors;
}

export function isPasswordValid(password) {
  return getPasswordValidationErrors(password).length === 0;
}

export const PASSWORD_REQUIREMENTS_TEXT =
  'Password must be at least 12 characters and include uppercase, lowercase, digits, and special characters.';

export function formatPasswordErrors(errors) {
  if (!errors?.length) return '';
  if (errors.length === 1) {
    return `Password must include ${errors[0]}.`;
  }
  const last = errors[errors.length - 1];
  const rest = errors.slice(0, -1).join(', ');
  return `Password must include ${rest}, and ${last}.`;
}
