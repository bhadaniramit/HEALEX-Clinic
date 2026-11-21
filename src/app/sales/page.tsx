import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/app-header";
import { formatInr, formatIst } from "@/lib/format";
import {
  startOfTodayIstIso,
  todayDateIst,
  todayLabelIst,
} from "@/lib/date-ist";
import { SalesExport } from "./sales-export";

export const dynamic = "force-dynamic";

type SaleRow = {
  id: string;
  amount: number;
  note: string | null;
  created_at: string;
  patients: { id: string; name: string; phone: string } | null;
};

export default async function TotalSaleTodayPage() {
  const profile = await requireStaff();
  if (profile.role !== "super_admin" && profile.role !== "admin") {
    redirect("/patients");
  }

  const supabase = await createClient();
  const since = startOfTodayIstIso();
  const todayYmd = todayDateIst();

  const { data, error } = await supabase
    .from("payments")
    .select("id, amount, note, created_at, patients(id, name, phone)")
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  const rows = (data as SaleRow[] | null) ?? [];
  const total = rows.reduce((sum, r) => sum + Number(r.amount), 0);

  return (
    <div className="min-h-screen bg-stone-100">
      <AppHeader
        profile={profile}
        title="Total Sale Today"
        activeTab="sales"
      />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <p className="text-sm text-stone-600">
          Money collected on {todayLabelIst()} (IST)
        </p>

        <div className="rounded-xl border border-stone-200 bg-white p-6">
          <p className="text-sm text-stone-500">Total sale today</p>
          <p className="mt-1 text-4xl font-semibold text-teal-900">
            {formatInr(total)}
          </p>
          <p className="mt-1 text-xs text-stone-400">
            {rows.length} payment{rows.length === 1 ? "" : "s"}
          </p>
        </div>

        <SalesExport defaultFrom={todayYmd} defaultTo={todayYmd} />

        {error ? (
          <p className="text-sm text-red-700">
            {error.message}
            {error.message.toLowerCase().includes("payments") ? (
              <>
                {" "}
                Run{" "}
                <code className="rounded bg-stone-200 px-1">
                  supabase/payment_split.sql
                </code>{" "}
                in Supabase SQL Editor.
              </>
            ) : null}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-2.5">
            <h2 className="text-sm font-medium text-stone-700">
              Payments today
            </h2>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-500">
              No payments recorded today.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-medium text-stone-900">
                      {r.patients?.name ?? "Patient"}
                    </p>
                    <p className="text-stone-500">
                      {r.patients?.phone ?? "—"} · {formatIst(r.created_at)}
                      {r.note ? ` · ${r.note}` : ""}
                    </p>
                  </div>
                  <p className="font-semibold text-teal-900">
                    {formatInr(r.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
