import { requireStaff } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";
import { PatientSearch } from "./patient-search";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  const profile = await requireStaff();

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader profile={profile} title="Patients" activeTab="patients" />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p className="mb-6 text-sm text-stone-600">
          Search by name or phone. Results are limited — the full patient list
          is never loaded.
        </p>
        <PatientSearch
          canAddPatient={
            profile.role === "super_admin" || profile.role === "admin"
          }
        />
      </main>
    </div>
  );
}
