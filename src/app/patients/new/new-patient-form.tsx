"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInr } from "@/lib/format";
import { normalizePatientPhone } from "@/lib/phone";
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
  const [loginInfo, setLoginInfo] = useState<{
    username: string;
    password: string;
  } | null>(null);

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  );

  const phone10 = normalizePatientPhone(phone);
  const previewPassword = phone10 ? phone10.slice(-4) : "————";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!packageId) {
      setError("Select a session package.");
      return;
    }
    if (!phone10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    setError(null);
    setLoginInfo(null);

    const res = await fetch("/api/patients/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        dob,
        address: address.trim(),
        phone: phone10,
        packageId,
      }),
    });

    const payload = (await res.json().catch(() => null)) as {
      error?: string;
      patientId?: string;
      login?: { username: string; password: string };
      loginHint?: { username: string; password: string };
    } | null;

    setLoading(false);

    if (!res.ok && res.status !== 207) {
      setError(payload?.error ?? "Could not save patient.");
      return;
    }

    if (payload?.error && !payload.patientId) {
      setError(payload.error);
      return;
    }

    const login = payload?.login ?? payload?.loginHint ?? null;
    if (login) {
      setLoginInfo(login);
    }

    if (payload?.patientId) {
      // Brief pause so staff can read credentials, then go to patient
      window.setTimeout(() => {
        router.push(`/patients/${payload.patientId}`);
        router.refresh();
      }, login ? 2500 : 0);
    }
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
        <span className="text-stone-700">Mobile number (10 digits)</span>
        <input
          required
          inputMode="numeric"
          pattern="[0-9]{10}"
          maxLength={10}
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
          placeholder="9876543210"
        />
        <span className="mt-1 block text-xs text-stone-500">
          Unique. Login username = this number. Password = last 4 digits (
          <strong>{previewPassword}</strong>).
        </span>
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

      {loginInfo ? (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          <p className="font-semibold">Patient login created</p>
          <p className="mt-1">
            Username: <strong>{loginInfo.username}</strong>
          </p>
          <p>
            Password: <strong>{loginInfo.password}</strong> (last 4 digits)
          </p>
          <p className="mt-1 text-xs text-teal-800">Opening patient page…</p>
        </div>
      ) : null}

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
