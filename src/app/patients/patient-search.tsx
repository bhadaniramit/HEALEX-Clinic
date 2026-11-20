"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/database.types";

export function PatientSearch({ canAddPatient }: { canAddPatient: boolean }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError("Enter at least 2 characters.");
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("search_patients", {
      p_query: q,
      p_limit: 25,
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      setResults([]);
      return;
    }

    setResults((data as Patient[]) ?? []);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={onSearch} className="flex min-w-[240px] flex-1 gap-2">
          <input
            type="search"
            placeholder="Name or phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
          >
            {loading ? "…" : "Search"}
          </button>
        </form>
        {canAddPatient ? (
          <Link
            href="/patients/new"
            className="rounded-lg border border-teal-800 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            Add patient
          </Link>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {searched && !loading && results.length === 0 && !error ? (
        <p className="text-sm text-stone-500">No patients matched.</p>
      ) : null}

      {results.length > 0 ? (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {results.map((p) => (
            <li key={p.id}>
              <Link
                href={`/patients/${p.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-stone-50"
              >
                <div>
                  <p className="font-medium text-stone-900">{p.name}</p>
                  <p className="text-sm text-stone-500">{p.phone}</p>
                </div>
                <p className="text-sm text-teal-800">
                  {p.sessions_remaining} left
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {!canAddPatient ? (
        <p className="text-xs text-stone-500">
          General access: search and open a patient to check in. Adding patients
          or sessions requires Admin.
        </p>
      ) : null}
    </div>
  );
}
