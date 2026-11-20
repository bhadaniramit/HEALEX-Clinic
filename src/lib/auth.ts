import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/database.types";
import { homeForRole, isStaffRole } from "@/lib/auth-shared";

export { homeForRole, isStaffRole } from "@/lib/auth-shared";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

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
