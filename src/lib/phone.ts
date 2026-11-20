/** Normalize to digits only. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** India-style 10-digit mobile (no country code). */
export function normalizePatientPhone(value: string): string | null {
  const d = digitsOnly(value);
  if (d.length === 10) return d;
  // Allow leading 91
  if (d.length === 12 && d.startsWith("91")) return d.slice(2);
  return null;
}

export function patientAuthEmail(phone10: string): string {
  return `${phone10}@patients.healex.local`;
}

export function patientDefaultPassword(phone10: string): string {
  return phone10.slice(-4);
}
