import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { homeForRole, isStaffRole } from "@/lib/auth-shared";
import { isPatientAuthEmail, phoneFromAuthEmail } from "@/lib/phone";

export { homeForRole, isStaffRole } from "@/lib/auth-shared";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Staff → row from `profiles`.
 * Patients → NOT stored in profiles; built from `patients` via 10-digit phone login.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Patient logins use mobile@patients.healex.local — resolve from patients DB only
  if (isPatientAuthEmail(user.email)) {
    const phone = phoneFromAuthEmail(user.email);
    if (!phone) return null;

    const { data: patient, error } = await supabase
      .from("patients")
      .select("id, name")
      .eq("phone", phone)
      .maybeSingle();

    if (error) {
      console.error("getProfile patient lookup", error.message);
      return null;
    }
    if (!patient) return null;

    return {
      id: user.id,
      full_name: patient.name,
      role: "patient",
      patient_id: patient.id,
      created_at: user.created_at,
      updated_at: user.created_at,
    };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getProfile", error.message);
    return null;
  }

  return data as Profile | null;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireProfile() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireStaff() {
  const profile = await requireProfile();
  if (!isStaffRole(profile.role)) redirect("/me");
  return profile;
}

export async function requirePatient() {
  const profile = await requireProfile();
  if (profile.role !== "patient") redirect(homeForRole(profile.role));
  return profile;
}
