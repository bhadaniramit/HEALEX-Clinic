import { requirePatient } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { formatIst } from "@/lib/format";
import { RequestSessions } from "./request-sessions";
import type {
  Recommendation,
  SessionPackage,
  Visit,
} from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const profile = await requirePatient();
  const supabase = await createClient();

  let patient: {
    name: string;
    phone: string;
    dob: string;
    address: string;
    sessions_remaining: number;
  } | null = null;
  let recommendations: Recommendation[] = [];
  let visits: Visit[] = [];

  if (profile.patient_id) {
    const [{ data: row }, { data: recs }, { data: visitRows }] =
      await Promise.all([
        supabase
          .from("patients")
          .select("name, phone, dob, address, sessions_remaining")
          .eq("id", profile.patient_id)
          .maybeSingle(),
        supabase
          .from("recommendations")
          .select("*")
          .eq("patient_id", profile.patient_id)
          .order("created_at", { ascending: false }),
        supabase
          .from("visits")
          .select("*")
          .eq("patient_id", profile.patient_id)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
    patient = row;
    recommendations = (recs as Recommendation[]) ?? [];
    visits = (visitRows as Visit[]) ?? [];
  }

  const { data: packages } = await supabase
    .from("session_packages")
    .select("*")
    .eq("active", true)
    .order("sessions_count", { ascending: true });

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader profile={profile} title="My profile" activeTab="me" />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-stone-500">Your profile</p>
              <p className="mt-1 text-xl font-semibold text-stone-900">
                {patient?.name ?? profile.full_name ?? "Your account"}
              </p>
            </div>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
              View only
            </span>
          </div>

          {patient ? (
            <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-stone-500">Mobile</dt>
                <dd className="mt-1 font-medium text-stone-900">
                  {patient.phone}
                </dd>
              </div>
              <div>
                <dt className="text-stone-500">Date of birth</dt>
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
                <dd className="mt-1 text-3xl font-semibold text-teal-900">
                  {patient.sessions_remaining}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-4 text-sm text-amber-800">
              No patient record found for this mobile login. Ask the clinic
              Admin to register your mobile number.
            </p>
          )}
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
            Medicine, exercise & diet
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
                  <p className="font-medium text-teal-900">
                    {r.type === "diet_lifestyle"
                      ? "Diet/Lifestyle"
                      : r.type === "medicine"
                        ? "Medicine"
                        : "Exercise"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-stone-800">
                    {r.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Recent visits</h2>
          {visits.length === 0 ? (
            <p className="mt-2 text-sm text-stone-500">No visits yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100 text-sm">
              {visits.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-stone-800">{formatIst(v.created_at)}</span>
                  <span className="text-stone-500">
                    {v.checked_out_at ? "Checked out" : "Checked in"} · IST
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
