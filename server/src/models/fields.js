// Reusable schema field definitions.

// Money is stored as whole paise (₹250.50 → 25050). Rejects fractions like 250.5.
export function paiseField(options = {}) {
  return {
    type: Number,
    validate: {
      validator: (value) => value === null || value === undefined || Number.isSafeInteger(value),
      message: '{PATH} must be a whole number of paise',
    },
    ...options,
  };
}

// Case-insensitive comparison for unique indexes: "HDFC Bank" and "hdfc bank" clash.
export const CASE_INSENSITIVE = { locale: 'en', strength: 2 };
