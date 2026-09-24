// "Asha Rao" → "AR", "asha" → "A", "" → "?"
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts.at(-1)[0] : (parts[0]?.[0] ?? '?');
  return letters.toUpperCase();
}

// "Asha Rao" → "Asha"
export function firstName(name = '') {
  return name.trim().split(/\s+/)[0] ?? '';
}
