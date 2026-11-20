import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { startOfTodayIstIso, todayLabelIst } from "@/lib/date-ist";
import { CheckedInList, type OpenCheckIn } from "./checked-in-list";

export const dynamic = "force-dynamic";

type VisitRow = {
  id: string;
  created_at: string;
  patient_id: string;
  checked_out_at: string | null;
  patients: {
    id: string;
    name: string;
    phone: string;
    sessions_remaining: number;
  } | null;
};

export default async function CheckedInPage() {
  const profile = await requireStaff();
  const supabase = await createClient();
  const since = startOfTodayIstIso();

  const [{ data: openVisits, error }, { data: allTodayVisits }] =
    await Promise.all([
      // Still on site (not checked out)
      supabase
        .from("visits")
        .select(
          "id, created_at, patient_id, checked_out_at, patients(id, name, phone, sessions_remaining)",
        )
        .gte("created_at", since)
        .is("checked_out_at", null)
        .order("created_at", { ascending: false }),
      // Every check-in today (for total unique patients)
      supabase
        .from("visits")
        .select("patient_id")
        .gte("created_at", since),
    ]);

  const rows = (openVisits as VisitRow[] | null) ?? [];

  const byPatient = new Map<string, VisitRow>();
  for (const v of rows) {
    if (!byPatient.has(v.patient_id)) {
      byPatient.set(v.patient_id, v);
    }
  }

  const openPatients: OpenCheckIn[] = Array.from(byPatient.values()).map(
    (v) => ({
      visitId: v.id,
      patientId: v.patient_id,
      name: v.patients?.name ?? "Patient",
      phone: v.patients?.phone ?? "—",
      sessionsRemaining: v.patients?.sessions_remaining ?? 0,
      checkedInAt: v.created_at,
    }),
  );

  const currentlyCheckedIn = openPatients.length;
  const totalCheckedInToday = new Set(
    (allTodayVisits ?? []).map((v) => v.patient_id as string),
  ).size;

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader
        profile={profile}
        title="Checked in today"
        activeTab="checked-in"
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <p className="text-sm text-stone-600">
          Check-ins for {todayLabelIst()} (IST)
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Currently checked in</p>
            <p className="mt-1 text-4xl font-semibold text-teal-900">
              {currentlyCheckedIn}
            </p>
            <p className="mt-1 text-xs text-stone-400">Not yet checked out</p>
          </div>
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Total checked in today</p>
            <p className="mt-1 text-4xl font-semibold text-stone-900">
              {totalCheckedInToday}
            </p>
            <p className="mt-1 text-xs text-stone-400">
              Unique patients (incl. checked out)
            </p>
          </div>
        </div>

        {error ? (
          <p className="text-sm text-red-700">
            {error.message}
            {error.message.includes("checked_out_at") ? (
              <>
                {" "}
                Run{" "}
                <code className="rounded bg-stone-200 px-1">
                  web/supabase/checkout_migration.sql
                </code>{" "}
                in Supabase SQL Editor.
              </>
            ) : null}
          </p>
        ) : null}

        <div>
          <h2 className="mb-3 text-sm font-medium text-stone-700">
            Currently on site
          </h2>
          <CheckedInList rows={openPatients} />
        </div>
      </main>
    </div>
  );
}
