"use client";

import { useState } from "react";

export function ReportExport({
  defaultFrom,
  defaultTo,
}: {
  defaultFrom: string;
  defaultTo: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState<"balance" | "paid" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(type: "balance" | "paid") {
    if (!from || !to) {
      setError("Select both From and To dates.");
      return;
    }
    if (from > to) {
      setError("From date must be on or before To date.");
      return;
    }
    setBusy(type);
    setError(null);
    try {
      const qs = new URLSearchParams({ type, from, to });
      const res = await fetch(`/api/sales/export?${qs.toString()}`);
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Download failed.");
        setBusy(null);
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(disposition);
      const filename =
        match?.[1] ??
        (type === "balance"
          ? `patient-balance_${from}_to_${to}.csv`
          : `patient-amount-paid_${from}_to_${to}.csv`);

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    }
    setBusy(null);
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="font-semibold text-stone-900">Download Excel (CSV)</h2>
      <p className="mt-1 text-sm text-stone-600">
        Choose a date range (IST). Files open in Excel.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="text-stone-700">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-stone-700">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => download("balance")}
          className="rounded-lg border border-teal-800 px-3 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:opacity-50"
        >
          {busy === "balance"
            ? "Downloading…"
            : "Patient Name & Balance"}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => download("paid")}
          className="rounded-lg bg-teal-800 px-3 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
        >
          {busy === "paid" ? "Downloading…" : "Patient Name & Amount Paid"}
        </button>
      </div>

      <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-stone-500">
        <li>
          <strong>Balance</strong> — patients with a payment in the range;
          current outstanding balance.
        </li>
        <li>
          <strong>Amount Paid</strong> — total money collected per patient in
          the range.
        </li>
      </ul>

      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </section>
  );
}
