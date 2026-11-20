import Link from "next/link";
import type { Profile } from "@/lib/database.types";
import { isStaffRole } from "@/lib/auth-shared";

const roleLabel: Record<Profile["role"], string> = {
  super_admin: "Super Admin (Doctor)",
  admin: "Admin",
  general: "General",
  patient: "Patient",
};

export function AppHeader({
  profile,
  title,
  activeTab,
}: {
  profile: Profile;
  title: string;
  activeTab?: "patients" | "checked-in" | "me";
}) {
  const staff = isStaffRole(profile.role);

  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto max-w-3xl px-4 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium tracking-wide text-teal-800 uppercase">
              HEALEX
            </p>
            <h1 className="text-lg font-semibold text-stone-900">{title}</h1>
            <p className="text-sm text-stone-500">
              {profile.full_name ?? "User"} · {roleLabel[profile.role]}
            </p>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              Sign out
            </button>
          </form>
        </div>

        {staff ? (
          <nav className="mt-4 flex gap-1 rounded-lg bg-stone-100 p-1">
            <TabLink
              href="/patients"
              label="Patients"
              active={activeTab === "patients"}
            />
            <TabLink
              href="/checked-in"
              label="Checked in today"
              active={activeTab === "checked-in"}
            />
          </nav>
        ) : null}
      </div>
    </header>
  );
}

function TabLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex-1 rounded-md bg-white px-3 py-2 text-center text-sm font-medium text-teal-900 shadow-sm"
          : "flex-1 rounded-md px-3 py-2 text-center text-sm font-medium text-stone-600 hover:text-stone-900"
      }
    >
      {label}
    </Link>
  );
}
