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

export const PATIENT_AUTH_DOMAIN = "patients.healex.local";

export function patientAuthEmail(phone10: string): string {
  return `${phone10}@${PATIENT_AUTH_DOMAIN}`;
}

/** Last 6 digits — matches Supabase minimum password length (6). */
export function patientDefaultPassword(phone10: string): string {
  return phone10.slice(-6);
}

export function isPatientAuthEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith(`@${PATIENT_AUTH_DOMAIN}`);
}

/** Extract 10-digit phone from Auth email like 9876543210@patients.healex.local */
export function phoneFromAuthEmail(email: string | null | undefined): string | null {
  if (!isPatientAuthEmail(email)) return null;
  const local = (email ?? "").split("@")[0] ?? "";
  return normalizePatientPhone(local);
}
