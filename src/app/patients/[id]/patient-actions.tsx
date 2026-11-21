"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatInr } from "@/lib/format";
import type {
  Payment,
  Recommendation,
  SessionPackage,
  SessionRequest,
  UserRole,
} from "@/lib/database.types";

export function PatientActions({
  patientId,
  sessionsRemaining,
  role,
  packages,
  recommendations,
  pendingRequests,
  alreadyCheckedInToday,
  paymentBalance,
  payments,
}: {
  patientId: string;
  sessionsRemaining: number;
  role: UserRole;
  packages: SessionPackage[];
  recommendations: Recommendation[];
  pendingRequests: (SessionRequest & { package_name?: string })[];
  alreadyCheckedInToday: boolean;
  paymentBalance: number;
  payments: Payment[];
}) {
  const router = useRouter();
  const canManageSessions = role === "super_admin" || role === "admin";
  const canWriteRecs = role === "super_admin";
  const canSplitPayment = role === "super_admin";
  const canCheckIn =
    role === "super_admin" || role === "admin" || role === "general";

  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkedInToday, setCheckedInToday] = useState(alreadyCheckedInToday);

  useEffect(() => {
    setCheckedInToday(alreadyCheckedInToday);
  }, [alreadyCheckedInToday]);

  const checkInDisabled =
    busy || sessionsRemaining <= 0 || checkedInToday;
  const [packageId, setPackageId] = useState(packages[0]?.id ?? "");
  const [amountPaidNow, setAmountPaidNow] = useState("");
  const [recordAmount, setRecordAmount] = useState("");
  const [recordNote, setRecordNote] = useState("");
  const [recType, setRecType] = useState<"medicine" | "exercise">("exercise");
  const [recContent, setRecContent] = useState("");

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  );

  useEffect(() => {
    if (selected) {
      setAmountPaidNow(String(selected.price));
    }
  }, [selected]);

  function flash(ok: string | null, err: string | null) {
    setMessage(ok);
    setError(err);
  }

  async function checkIn() {
    if (checkedInToday) return;
    setBusy(true);
    flash(null, null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("check_in_patient", {
      p_patient_id: patientId,
      p_note: null,
    });
    setBusy(false);
    if (rpcError) {
      flash(null, rpcError.message);
      if (rpcError.message.toLowerCase().includes("already checked in")) {
        setCheckedInToday(true);
      }
      return;
    }
    setCheckedInToday(true);
    flash("Checked in — 1 session used.", null);
    router.refresh();
  }

  async function addSessions() {
    if (!packageId) {
      flash(null, "Select a package.");
      return;
    }
    const paid = Number(amountPaidNow);
    if (
      canSplitPayment &&
      (Number.isNaN(paid) || paid < 0 || (selected && paid > selected.price))
    ) {
      flash(null, "Enter a valid amount paid (0 to package price).");
      return;
    }
    setBusy(true);
    flash(null, null);
    const supabase = createClient();
    const args: {
      p_patient_id: string;
      p_package_id: string;
      p_amount_paid?: number;
    } = {
      p_patient_id: patientId,
      p_package_id: packageId,
    };
    if (canSplitPayment) {
      args.p_amount_paid = paid;
    }
    const { error: rpcError } = await supabase.rpc(
      "add_sessions_to_patient",
      args,
    );
    setBusy(false);
    if (rpcError) {
      flash(null, rpcError.message);
      return;
    }
    flash(
      canSplitPayment && selected && paid < selected.price
        ? "Sessions added with partial payment."
        : "Sessions added.",
      null,
    );
    router.refresh();
  }

  async function recordPayment() {
    const amount = Number(recordAmount);
    if (Number.isNaN(amount) || amount <= 0) {
      flash(null, "Enter a payment amount greater than 0.");
      return;
    }
    if (amount > paymentBalance) {
      flash(null, `Amount cannot exceed balance (${paymentBalance}).`);
      return;
    }
    setBusy(true);
    flash(null, null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("record_patient_payment", {
      p_patient_id: patientId,
      p_amount: amount,
      p_note: recordNote.trim() || null,
    });
    setBusy(false);
    if (rpcError) {
      flash(null, rpcError.message);
      return;
    }
    setRecordAmount("");
    setRecordNote("");
    flash("Payment recorded.", null);
    router.refresh();
  }

  async function addRecommendation() {
    if (!recContent.trim()) {
      flash(null, "Enter recommendation text.");
      return;
    }
    setBusy(true);
    flash(null, null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("recommendations").insert({
      patient_id: patientId,
      type: recType,
      content: recContent.trim(),
      created_by: user?.id ?? null,
    });
    setBusy(false);
    if (insertError) {
      flash(null, insertError.message);
      return;
    }
    setRecContent("");
    flash("Recommendation saved.", null);
    router.refresh();
  }

  async function reviewRequest(id: string, approve: boolean) {
    setBusy(true);
    flash(null, null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      approve ? "approve_session_request" : "reject_session_request",
      { p_request_id: id },
    );
    setBusy(false);
    if (rpcError) {
      flash(null, rpcError.message);
      return;
    }
    flash(approve ? "Request approved." : "Request rejected.", null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {canCheckIn ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Check-in</h2>
          <p className="mt-1 text-sm text-stone-600">
            Uses 1 session. One check-in allowed per day (IST). Balance:{" "}
            <strong>{sessionsRemaining}</strong>
          </p>
          <button
            type="button"
            disabled={checkInDisabled}
            onClick={checkIn}
            className={
              checkInDisabled
                ? "mt-4 cursor-not-allowed rounded-lg bg-stone-300 px-4 py-2 text-sm font-medium text-stone-500"
                : "mt-4 rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900"
            }
          >
            {checkedInToday
              ? "Already checked in today"
              : "Check in (−1 session)"}
          </button>
          {checkedInToday ? (
            <p className="mt-2 text-sm text-stone-500">
              This patient can check in again tomorrow.
            </p>
          ) : null}
          {!checkedInToday && sessionsRemaining <= 0 ? (
            <p className="mt-2 text-sm text-amber-800">
              No sessions left. Add a package first.
            </p>
          ) : null}
        </section>
      ) : null}

      {canManageSessions ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Add more sessions</h2>
          <label className="mt-3 block text-sm">
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
          <p className="mt-3 text-sm text-teal-900">
            Package charge:{" "}
            <strong>{selected ? formatInr(selected.price) : "—"}</strong>
            {selected ? ` · +${selected.sessions_count} sessions` : null}
          </p>
          {canSplitPayment ? (
            <label className="mt-3 block text-sm">
              <span className="text-stone-700">
                Amount paid now (split allowed)
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                max={selected?.price}
                value={amountPaidNow}
                onChange={(e) => setAmountPaidNow(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-stone-500">
                Enter less than package price to leave a balance.
              </span>
            </label>
          ) : null}
          <button
            type="button"
            disabled={busy || !packageId}
            onClick={addSessions}
            className="mt-4 rounded-lg border border-teal-800 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:opacity-50"
          >
            Add sessions
          </button>
        </section>
      ) : null}

      {canSplitPayment ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Record payment</h2>
          <p className="mt-1 text-sm text-stone-600">
            Outstanding balance:{" "}
            <strong>{formatInr(paymentBalance)}</strong>
          </p>
          {paymentBalance <= 0 ? (
            <p className="mt-3 text-sm text-stone-500">No balance due.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <label className="block text-sm">
                <span className="text-stone-700">Amount</span>
                <input
                  type="number"
                  min={0.01}
                  step="0.01"
                  max={paymentBalance}
                  value={recordAmount}
                  onChange={(e) => setRecordAmount(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                  placeholder="e.g. 500"
                />
              </label>
              <label className="block text-sm">
                <span className="text-stone-700">Note (optional)</span>
                <input
                  type="text"
                  value={recordNote}
                  onChange={(e) => setRecordNote(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                  placeholder="Cash / UPI / instalment…"
                />
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={recordPayment}
                className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-50"
              >
                Record payment
              </button>
            </div>
          )}
          {payments.length > 0 ? (
            <ul className="mt-4 divide-y divide-stone-100 border-t border-stone-100 pt-3 text-sm">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  <span className="text-stone-600">
                    {new Date(p.created_at).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                    {p.note ? ` · ${p.note}` : ""}
                  </span>
                  <span className="font-medium text-teal-900">
                    {formatInr(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {canManageSessions && pendingRequests.length > 0 ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">
            Pending session requests
          </h2>
          <ul className="mt-3 space-y-3">
            {pendingRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm"
              >
                <span>{r.package_name ?? "Package"} · pending</span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reviewRequest(r.id, true)}
                    className="rounded bg-teal-800 px-2 py-1 text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => reviewRequest(r.id, false)}
                    className="rounded border border-stone-300 px-2 py-1"
                  >
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="font-semibold text-stone-900">
          Medicine & exercise
        </h2>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No recommendations yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recommendations.map((r) => (
              <li key={r.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
                <p className="font-medium capitalize text-teal-900">{r.type}</p>
                <p className="mt-1 whitespace-pre-wrap text-stone-800">
                  {r.content}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canWriteRecs ? (
          <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
            <label className="block text-sm">
              <span className="text-stone-700">Type</span>
              <select
                value={recType}
                onChange={(e) =>
                  setRecType(e.target.value as "medicine" | "exercise")
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              >
                <option value="exercise">Exercise</option>
                <option value="medicine">Medicine</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-stone-700">Recommendation</span>
              <textarea
                rows={3}
                value={recContent}
                onChange={(e) => setRecContent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
                placeholder="e.g. Stretching routine, dosage notes…"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={addRecommendation}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-50"
            >
              Save recommendation
            </button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-stone-500">
            Only Super Admin (Doctor) can add recommendations.
          </p>
        )}
      </section>
    </div>
  );
}
