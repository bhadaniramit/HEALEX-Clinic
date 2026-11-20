"use client";

import { useState } from "react";
import Link from "next/link";
import { formatIst } from "@/lib/format";

export type TodayCheckIn = {
  visitId: string;
  patientId: string;
  name: string;
  checkedInAt: string;
};

export function TotalCheckedInToday({
  count,
  rows,
  canExpand,
}: {
  count: number;
  rows: TodayCheckIn[];
  canExpand: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-3">
      {canExpand ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full rounded-xl border border-stone-200 bg-white p-5 text-left transition hover:border-teal-700 hover:bg-teal-50/40 focus:outline-none focus:ring-2 focus:ring-teal-700"
          aria-expanded={open}
        >
          <p className="text-sm text-stone-500">Total checked in today</p>
          <p className="mt-1 text-4xl font-semibold text-stone-900">{count}</p>
          <p className="mt-1 text-xs text-teal-800">
            {open ? "Hide list ▲" : "Tap to view names & times ▼"}
          </p>
        </button>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <p className="text-sm text-stone-500">Total checked in today</p>
          <p className="mt-1 text-4xl font-semibold text-stone-900">{count}</p>
          <p className="mt-1 text-xs text-stone-400">
            Unique patients (incl. checked out)
          </p>
        </div>
      )}

      {canExpand && open ? (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-4 py-2.5">
            <h3 className="text-sm font-medium text-stone-700">
              Checked in today
            </h3>
          </div>
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-stone-500">
              No check-ins yet today.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {rows.map((row) => (
                <li key={row.visitId} className="px-4 py-3">
                  <Link
                    href={`/patients/${row.patientId}`}
                    className="flex items-center justify-between gap-3 hover:underline"
                  >
                    <span className="font-medium text-stone-900">
                      {row.name}
                    </span>
                    <span className="shrink-0 text-sm text-stone-500">
                      {formatIst(row.checkedInAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
