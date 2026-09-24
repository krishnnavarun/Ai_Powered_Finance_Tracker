// Puts server-side validation errors next to the matching form fields.
// Returns true if at least one field got an error (so no general alert is needed).
export function applyServerErrors(form, error, fields) {
  let applied = false;

  if (error?.code === 'EMAIL_TAKEN' && fields.includes('email')) {
    form.setError('email', { message: error.message }, { shouldFocus: true });
    applied = true;
  }

  if (error?.code === 'DUPLICATE_NAME' && fields.includes('name')) {
    form.setError('name', { message: error.message }, { shouldFocus: true });
    applied = true;
  }

  if (error?.code === 'VALIDATION_ERROR' && Array.isArray(error.details)) {
    for (const { path, message } of error.details) {
      if (fields.includes(path)) {
        form.setError(path, { message });
        applied = true;
      }
    }
  }

  return applied;
}
