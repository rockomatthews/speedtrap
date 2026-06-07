export function normalizeUsPhone(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) {
    const normalized = `+${trimmed.slice(1).replace(/\D/g, '')}`;
    return normalized.length >= 11 && normalized.length <= 16 ? normalized : null;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

export function isValidUsPhone(value: string) {
  return Boolean(normalizeUsPhone(value));
}
