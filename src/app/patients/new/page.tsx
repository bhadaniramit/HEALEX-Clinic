import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { NewPatientForm } from "./new-patient-form";
import type { SessionPackage } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function NewPatientPage() {
  const profile = await requireStaff();
  if (profile.role !== "super_admin" && profile.role !== "admin") {
    redirect("/patients");
  }

  const supabase = await createClient();
  const { data: packages } = await supabase
    .from("session_packages")
    .select("*")
    .eq("active", true)
    .order("sessions_count", { ascending: true });

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader profile={profile} title="Add patient" activeTab="patients" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <p className="text-sm text-stone-600">
          Enter patient details and choose a session package. Charges come from
          the database.
        </p>
        <NewPatientForm
          packages={(packages as SessionPackage[]) ?? []}
          canSplitPayment={profile.role === "super_admin"}
        />
        <Link
          href="/patients"
          className="inline-block text-sm font-medium text-teal-900 hover:underline"
        >
          ← Back to search
        </Link>
      </main>
    </div>
  );
}
