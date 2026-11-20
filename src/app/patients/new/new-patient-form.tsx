"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatInr } from "@/lib/format";
import type { SessionPackage } from "@/lib/database.types";

export function NewPatientForm({ packages }: { packages: SessionPackage[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!packageId) {
      setError("Select a session package.");
      return;
    }

    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc(
      "create_patient_with_package",
      {
        p_name: name.trim(),
        p_dob: dob,
        p_address: address.trim(),
        p_phone: phone.trim(),
        p_package_id: packageId,
      },
    );

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    const patient = data as { id: string };
    router.push(`/patients/${patient.id}`);
    router.refresh();
  }

  if (packages.length === 0) {
    return (
      <p className="text-sm text-amber-800">
        No active session packages found. Add rows in Supabase →{" "}
        <code>session_packages</code>.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-stone-200 bg-white p-6">
      <label className="block text-sm">
        <span className="text-stone-700">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Date of birth</span>
        <input
          type="date"
          required
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Address</span>
        <textarea
          required
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Phone number</span>
        <input
          required
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Sessions opted</span>
        <select
          required
          value={packageId}
          onChange={(e) => setPackageId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        >
          {packages.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.sessions_count} sessions)
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-lg bg-teal-50 px-4 py-3 text-sm text-teal-950">
        <span className="text-teal-800">Charges: </span>
        <span className="text-lg font-semibold">
          {selected ? formatInr(selected.price) : "—"}
        </span>
        {selected ? (
          <span className="text-teal-800">
            {" "}
            · {selected.sessions_count} sessions
          </span>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save patient"}
      </button>
    </form>
  );
}
