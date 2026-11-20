import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { formatIst } from "@/lib/format";
import { startOfTodayIstIso } from "@/lib/date-ist";
import { PatientActions } from "./patient-actions";
import { EditPatientForm } from "./edit-patient-form";
import type {
  Patient,
  Recommendation,
  SessionPackage,
  SessionRequest,
  Visit,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireStaff();
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!patient) notFound();

  const sinceToday = startOfTodayIstIso();

  const [
    { data: packages },
    { data: recommendations },
    { data: requests },
    { data: visits },
    { data: todayVisits },
  ] = await Promise.all([
    supabase
      .from("session_packages")
      .select("*")
      .eq("active", true)
      .order("sessions_count", { ascending: true }),
    supabase
      .from("recommendations")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("session_requests")
      .select("*, session_packages(name)")
      .eq("patient_id", id)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("visits")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("visits")
      .select("id")
      .eq("patient_id", id)
      .gte("created_at", sinceToday)
      .limit(1),
  ]);

  const alreadyCheckedInToday = (todayVisits?.length ?? 0) > 0;

  const pendingRequests = ((requests as Array<
    SessionRequest & { session_packages?: { name: string } | null }
  >) ?? []).map((r) => ({
    ...r,
    package_name: r.session_packages?.name,
  }));

  const visitList = (visits as Visit[]) ?? [];

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader
        profile={profile}
        title={patient.name}
        activeTab="patients"
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Phone</dt>
              <dd className="mt-1 font-medium text-stone-900">{patient.phone}</dd>
            </div>
            <div>
              <dt className="text-stone-500">DOB</dt>
              <dd className="mt-1 font-medium text-stone-900">{patient.dob}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-stone-500">Address</dt>
              <dd className="mt-1 font-medium text-stone-900">
                {patient.address || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Sessions remaining</dt>
              <dd className="mt-1 text-2xl font-semibold text-teal-900">
                {patient.sessions_remaining}
              </dd>
            </div>
          </dl>
        </div>

        {profile.role === "super_admin" ? (
          <EditPatientForm patient={patient as Patient} />
        ) : null}

        <PatientActions
          patientId={patient.id}
          sessionsRemaining={patient.sessions_remaining}
          role={profile.role}
          packages={(packages as SessionPackage[]) ?? []}
          recommendations={(recommendations as Recommendation[]) ?? []}
          pendingRequests={pendingRequests}
          alreadyCheckedInToday={alreadyCheckedInToday}
        />

        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Recent check-ins</h2>
          {visitList.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No visits yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 text-sm">
              {visitList.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-stone-800">{formatIst(v.created_at)}</span>
                  <span className="text-stone-500">IST</span>
                </li>
              ))}
            </ul>
          )}
        </section>

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
