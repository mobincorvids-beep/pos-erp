// Paired with client/src/lib/validation.js — see the header comment there for the
// full validation pattern used across the app's forms.
//
// Usage: <FieldError message={touched.email ? errors.email : null} />
export function FieldError({ message }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs font-medium text-danger">
      {message}
    </p>
  );
}

/** Convenience: className to append to a .field-input when it has a visible error. */
export function errorInputClass(hasError) {
  return hasError ? '!border-danger focus:!border-danger' : '';
}
