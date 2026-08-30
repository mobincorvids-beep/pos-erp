// Shared field-level validation helpers for React forms across the app.
//
// Pattern for any page adding validation:
//   1. Keep a `touched` object (fieldName -> bool) alongside your form state.
//   2. On each input's onBlur, mark it touched: setTouched(t => ({ ...t, field: true })).
//   3. Compute `errors` with `validate(values, rules)` (or hand-rolled per-field checks)
//      and re-run it on every change once a field is touched, and always before submit.
//   4. Show `<FieldError message={touched.field ? errors.field : null} />` under the input,
//      and add HTML5 attributes (type, required, min, max, step, pattern, maxLength) as the
//      first line of defense.
//   5. Disable the submit button while `Object.keys(errors).length > 0`, and re-check
//      `validate(...)` again inside the submit handler (belt and suspenders — covers
//      fields the user never touched).
//
// See client/src/components/FieldError.jsx for the paired error-display component, and
// LoginPage.jsx / RegisterPage.jsx / PosPage.jsx / ProductsPage.jsx / CustomersPage.jsx /
// SuppliersPage.jsx / SettingsPage.jsx (Tax Payments tab) for worked examples.

/** Pakistani mobile number format, reused from src/services/paymentGateways/jazzCashService.js */
export const PK_PHONE_REGEX = /^03\d{9}$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

export function validateEmail(value, { required = true } = {}) {
  if (isBlank(value)) return required ? 'Email is required.' : null;
  if (!EMAIL_REGEX.test(String(value).trim())) return 'Enter a valid email address.';
  return null;
}

export function validatePkPhone(value, { required = true, label = 'Phone number' } = {}) {
  if (isBlank(value)) return required ? `${label} is required.` : null;
  if (!PK_PHONE_REGEX.test(String(value).trim())) {
    return `${label} must be a valid Pakistani mobile number (03XXXXXXXXX).`;
  }
  return null;
}

export function validateRequired(value, label = 'This field') {
  return isBlank(value) ? `${label} is required.` : null;
}

export function validatePassword(value, { minLength = 8 } = {}) {
  if (isBlank(value)) return 'Password is required.';
  if (String(value).length < minLength) return `Password must be at least ${minLength} characters.`;
  return null;
}

/**
 * Validates a non-negative number (price, cost, amount). Returns a specific message,
 * or null when valid.
 */
export function validateNonNegativeNumber(value, label = 'Amount', { required = true } = {}) {
  if (isBlank(value)) return required ? `${label} is required.` : null;
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < 0) return `${label} cannot be negative.`;
  return null;
}

/** Validates a positive number (> 0), for cases where zero genuinely makes no sense. */
export function validatePositiveNumber(value, label = 'Amount', { required = true } = {}) {
  if (isBlank(value)) return required ? `${label} is required.` : null;
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n <= 0) return `${label} must be greater than 0.`;
  return null;
}

export function validatePercentage(value, label = 'Percentage', { required = false } = {}) {
  if (isBlank(value)) return required ? `${label} is required.` : null;
  const n = Number(value);
  if (Number.isNaN(n)) return `${label} must be a number.`;
  if (n < 0 || n > 100) return `${label} must be between 0 and 100.`;
  return null;
}

/**
 * Runs a set of { field: (value, allValues) => errorOrNull } rules against `values`.
 * Returns an errors object containing only fields with a non-null message.
 */
export function validate(values, rules) {
  const errors = {};
  for (const field of Object.keys(rules)) {
    const message = rules[field](values[field], values);
    if (message) errors[field] = message;
  }
  return errors;
}

export function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}
