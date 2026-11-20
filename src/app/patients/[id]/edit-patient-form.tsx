"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Patient } from "@/lib/database.types";

export function EditPatientForm({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [name, setName] = useState(patient.name);
  const [dob, setDob] = useState(patient.dob);
  const [address, setAddress] = useState(patient.address ?? "");
  const [phone, setPhone] = useState(patient.phone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("update_patient_details", {
      p_patient_id: patient.id,
      p_name: name.trim(),
      p_dob: dob,
      p_address: address.trim(),
      p_phone: phone.trim(),
    });

    setBusy(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setMessage("Patient details saved.");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-stone-900">Patient details</h2>
            <p className="mt-1 text-sm text-stone-500">
              Super Admin can edit name, DOB, address, and phone.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-lg border border-teal-800 px-3 py-1.5 text-sm font-medium text-teal-900 hover:bg-teal-50"
          >
            Edit
          </button>
        </div>
        {message ? (
          <p className="mt-3 text-sm text-teal-800">{message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    >
      <h2 className="font-semibold text-stone-900">Edit patient</h2>
      <label className="block text-sm">
        <span className="text-stone-700">Name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Date of birth</span>
        <input
          type="date"
          required
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Address</span>
        <textarea
          required
          rows={2}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Phone number</span>
        <input
          required
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
        />
        <span className="mt-1 block text-xs text-stone-500">
          Must be unique across all patients.
        </span>
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError(null);
            setName(patient.name);
            setDob(patient.dob);
            setAddress(patient.address ?? "");
            setPhone(patient.phone);
          }}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
