import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { RequestSessions } from "./request-sessions";
import type { Recommendation, SessionPackage } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const profile = await requirePatient();
  const supabase = await createClient();

  let sessionsRemaining: number | null = null;
  let patientName: string | null = null;
  let recommendations: Recommendation[] = [];

  if (profile.patient_id) {
    const [{ data: patient }, { data: recs }] = await Promise.all([
      supabase
        .from("patients")
        .select("name, sessions_remaining")
        .eq("id", profile.patient_id)
        .maybeSingle(),
      supabase
        .from("recommendations")
        .select("*")
        .eq("patient_id", profile.patient_id)
        .order("created_at", { ascending: false }),
    ]);
    sessionsRemaining = patient?.sessions_remaining ?? null;
    patientName = patient?.name ?? null;
    recommendations = (recs as Recommendation[]) ?? [];
  }

  const { data: packages } = await supabase
    .from("session_packages")
    .select("*")
    .eq("active", true)
    .order("sessions_count", { ascending: true });

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader profile={profile} title="My sessions" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <p className="text-sm text-stone-500">Patient</p>
          <p className="mt-1 text-xl font-semibold text-stone-900">
            {patientName ?? profile.full_name ?? "Your account"}
          </p>
          <p className="mt-6 text-sm text-stone-500">Sessions remaining</p>
          <p className="mt-1 text-4xl font-semibold text-teal-900">
            {sessionsRemaining ?? "—"}
          </p>
          {!profile.patient_id ? (
            <p className="mt-4 text-sm text-amber-800">
              This login is not linked to a patient record yet. Ask the clinic
              Admin to set <code>profiles.patient_id</code> for your user.
            </p>
          ) : null}
        </div>

        {profile.patient_id ? (
          <div className="rounded-xl border border-stone-200 bg-white p-6">
            <h2 className="font-semibold text-stone-900">
              Request more sessions
            </h2>
            <p className="mt-1 text-sm text-stone-600">
              Admin or Super Admin will approve before sessions are added.
            </p>
            <div className="mt-4">
              <RequestSessions
                packages={(packages as SessionPackage[]) ?? []}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="font-semibold text-stone-900">
            Medicine & exercise
          </h2>
          {recommendations.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">
              No recommendations from the doctor yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {recommendations.map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg bg-stone-50 px-3 py-2 text-sm"
                >
                  <p className="font-medium capitalize text-teal-900">{r.type}</p>
                  <p className="mt-1 whitespace-pre-wrap text-stone-800">
                    {r.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
