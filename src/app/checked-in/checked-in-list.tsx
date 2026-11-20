"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatIst } from "@/lib/format";

export type OpenCheckIn = {
  visitId: string;
  patientId: string;
  name: string;
  phone: string;
  sessionsRemaining: number;
  checkedInAt: string;
};

export function CheckedInList({ rows }: { rows: OpenCheckIn[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkOut(patientId: string) {
    setBusyId(patientId);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("check_out_patient", {
      p_patient_id: patientId,
    });
    setBusyId(null);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-500">
        No patients currently checked in.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
        {rows.map((row) => (
          <li
            key={row.visitId}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
          >
            <Link
              href={`/patients/${row.patientId}`}
              className="min-w-0 flex-1 hover:underline"
            >
              <p className="font-medium text-stone-900">{row.name}</p>
              <p className="text-sm text-stone-500">
                {row.phone} · checked in {formatIst(row.checkedInAt)} ·{" "}
                {row.sessionsRemaining} left
              </p>
            </Link>
            <button
              type="button"
              disabled={busyId === row.patientId}
              onClick={() => checkOut(row.patientId)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:opacity-50"
            >
              {busyId === row.patientId ? "…" : "Checkout"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
