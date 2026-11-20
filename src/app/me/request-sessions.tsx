"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatInr } from "@/lib/format";
import type { SessionPackage } from "@/lib/database.types";

export function RequestSessions({ packages }: { packages: SessionPackage[] }) {
  const router = useRouter();
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  );

  async function onRequest() {
    if (!packageId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("request_more_sessions", {
      p_package_id: packageId,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMessage("Request sent. The clinic will review it.");
    router.refresh();
  }

  if (packages.length === 0) {
    return (
      <p className="text-sm text-stone-500">No packages available to request.</p>
    );
  }

  return (
    <div className="space-y-3">
      <label className="block text-sm">
        <span className="text-stone-700">Package</span>
        <select
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatInr(p.price)}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm text-teal-900">
        Charges (if approved):{" "}
        <strong>{selected ? formatInr(selected.price) : "—"}</strong>
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={onRequest}
        className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Request more sessions"}
      </button>
      {message ? <p className="text-sm text-teal-800">{message}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
