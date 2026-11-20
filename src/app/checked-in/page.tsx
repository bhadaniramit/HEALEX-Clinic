import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { startOfTodayIstIso, todayLabelIst } from "@/lib/date-ist";
import { CheckedInList, type OpenCheckIn } from "./checked-in-list";
import {
  TotalCheckedInToday,
  type TodayCheckIn,
} from "./total-checked-in-today";

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
  const canExpandTotal =
    profile.role === "super_admin" || profile.role === "admin";

  const [{ data: openVisits, error }, { data: allTodayVisits, error: todayError }] =
    await Promise.all([
      supabase
        .from("visits")
        .select(
          "id, created_at, patient_id, checked_out_at, patients(id, name, phone, sessions_remaining)",
        )
        .gte("created_at", since)
        .is("checked_out_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("visits")
        .select(
          "id, created_at, patient_id, patients(id, name)",
        )
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
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

  type TodayVisitRow = {
    id: string;
    created_at: string;
    patient_id: string;
    patients: { id: string; name: string } | null;
  };

  const todayRows = (allTodayVisits as TodayVisitRow[] | null) ?? [];

  // One entry per patient (earliest / first check-in of the day)
  const firstByPatient = new Map<string, TodayVisitRow>();
  for (const v of [...todayRows].reverse()) {
    if (!firstByPatient.has(v.patient_id)) {
      firstByPatient.set(v.patient_id, v);
    }
  }

  const todayCheckIns: TodayCheckIn[] = Array.from(firstByPatient.values())
    .map((v) => ({
      visitId: v.id,
      patientId: v.patient_id,
      name: v.patients?.name ?? "Patient",
      checkedInAt: v.created_at,
    }))
    .sort(
      (a, b) =>
        new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime(),
    );

  const currentlyCheckedIn = openPatients.length;
  const totalCheckedInToday = todayCheckIns.length;

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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">Currently checked in</p>
            <p className="mt-1 text-4xl font-semibold text-teal-900">
              {currentlyCheckedIn}
            </p>
            <p className="mt-1 text-xs text-stone-400">Not yet checked out</p>
          </div>
          <TotalCheckedInToday
            count={totalCheckedInToday}
            rows={todayCheckIns}
            canExpand={canExpandTotal}
          />
        </div>

        {error || todayError ? (
          <p className="text-sm text-red-700">
            {(error ?? todayError)?.message}
            {(error ?? todayError)?.message.includes("checked_out_at") ? (
              <>
                {" "}
                Run{" "}
                <code className="rounded bg-stone-200 px-1">
                  supabase/checkout_migration.sql
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
