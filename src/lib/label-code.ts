export function normalizeLabelCode(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function labelCodeCandidates(value: string) {
  const normalized = normalizeLabelCode(value);
  const compact = normalized.replace(/-/g, "");
  const candidates = new Set([normalized, compact]);

  if (compact.length > 4) {
    candidates.add(`${compact.slice(0, -4)}-${compact.slice(-4)}`);
  }

  return [...candidates].filter(Boolean);
}