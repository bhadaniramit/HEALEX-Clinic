import type { UserRole } from "@/lib/database.types";

export function isStaffRole(role: UserRole | null | undefined): boolean {
  return role === "super_admin" || role === "admin" || role === "general";
}

export function homeForRole(role: UserRole | null | undefined): string {
  if (role === "patient") return "/me";
  if (isStaffRole(role)) return "/patients";
  return "/login";
}
