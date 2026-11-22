"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatInr } from "@/lib/format";
import { printRecommendationsLetterhead } from "@/lib/print-recommendations";
import type {
  Payment,
  Recommendation,
  RecommendationType,
  SessionPackage,
  SessionRequest,
  UserRole,
} from "@/lib/database.types";
import { recommendationTypeLabel } from "@/lib/database.types";

export function PatientActions({
  patientId,
  patientName,
  patientPhone,
  patientDob,
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
  patientName: string;
  patientPhone: string;
  patientDob: string;
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
  const canAddSessions = role === "super_admin";
  const canReviewRequests = role === "super_admin" || role === "admin";
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
  const [payRemainingBalance, setPayRemainingBalance] = useState(false);
  const [recType, setRecType] = useState<RecommendationType>("exercise");
  const [recContent, setRecContent] = useState("");

  const selected = useMemo(
    () => packages.find((p) => p.id === packageId) ?? null,
    [packages, packageId],
  );

  const maxAmountPaid = payRemainingBalance
    ? paymentBalance
    : (selected?.price ?? 0);

  useEffect(() => {
    if (payRemainingBalance) {
      setAmountPaidNow(paymentBalance > 0 ? String(paymentBalance) : "");
      return;
    }
    // Manual entry when adding sessions — do not auto-fill from package price
    setAmountPaidNow("");
  }, [payRemainingBalance, paymentBalance]);

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

  async function addSessionsOrPayBalance() {
    const paid = Number(amountPaidNow);

    if (payRemainingBalance) {
      if (paymentBalance <= 0) {
        flash(null, "No remaining balance to pay.");
        return;
      }
      if (Number.isNaN(paid) || paid <= 0) {
        flash(null, "Enter a payment amount greater than 0.");
        return;
      }
      if (paid > paymentBalance) {
        flash(
          null,
          `Amount cannot exceed balance (${formatInr(paymentBalance)}).`,
        );
        return;
      }
      setBusy(true);
      flash(null, null);
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("record_patient_payment", {
        p_patient_id: patientId,
        p_amount: paid,
        p_note: "Pay remaining balance",
      });
      setBusy(false);
      if (rpcError) {
        flash(null, rpcError.message);
        return;
      }
      setPayRemainingBalance(false);
      flash("Balance payment recorded.", null);
      router.refresh();
      return;
    }

    if (!packageId) {
      flash(null, "Select a package.");
      return;
    }
    if (
      Number.isNaN(paid) ||
      paid < 0 ||
      (selected && paid > selected.price)
    ) {
      flash(null, "Enter a valid amount paid (0 to package price).");
      return;
    }
    setBusy(true);
    flash(null, null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc(
      "add_sessions_to_patient",
      {
        p_patient_id: patientId,
        p_package_id: packageId,
        p_amount_paid: paid,
      },
    );
    setBusy(false);
    if (rpcError) {
      flash(null, rpcError.message);
      return;
    }
    flash(
      selected && paid < selected.price
        ? "Sessions added with partial payment."
        : "Sessions added.",
      null,
    );
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

      {canAddSessions ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-stone-900">Add more sessions</h2>
            {canSplitPayment ? (
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={payRemainingBalance}
                  disabled={paymentBalance <= 0}
                  onChange={(e) => setPayRemainingBalance(e.target.checked)}
                  className="h-4 w-4 rounded border-stone-300 text-teal-800 focus:ring-teal-700"
                />
                Pay Remaining Balance
              </label>
            ) : null}
          </div>

          {canSplitPayment && payRemainingBalance ? (
            <p className="mt-2 text-sm text-amber-800">
              Outstanding balance: <strong>{formatInr(paymentBalance)}</strong>
            </p>
          ) : null}

          <label className="mt-3 block text-sm">
            <span className="text-stone-700">Package</span>
            <select
              value={packageId}
              onChange={(e) => setPackageId(e.target.value)}
              disabled={payRemainingBalance}
              className={
                payRemainingBalance
                  ? "mt-1 w-full cursor-not-allowed rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-stone-400"
                  : "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              }
            >
              {packages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatInr(p.price)}
                </option>
              ))}
            </select>
          </label>

          {!payRemainingBalance ? (
            <p className="mt-3 text-sm text-teal-900">
              Package charge:{" "}
              <strong>{selected ? formatInr(selected.price) : "—"}</strong>
              {selected ? ` · +${selected.sessions_count} sessions` : null}
            </p>
          ) : null}

          <label className="mt-3 block text-sm">
            <span className="text-stone-700">Amount paid now</span>
            <input
              type="number"
              min={payRemainingBalance ? 0.01 : 0}
              step="0.01"
              max={maxAmountPaid}
              value={amountPaidNow}
              onChange={(e) => {
                const next = e.target.value;
                const n = Number(next);
                if (
                  next !== "" &&
                  !Number.isNaN(n) &&
                  n > maxAmountPaid
                ) {
                  setAmountPaidNow(String(maxAmountPaid));
                  return;
                }
                setAmountPaidNow(next);
              }}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
            />
            <span className="mt-1 block text-xs text-stone-500">
              {payRemainingBalance
                ? `Cannot exceed balance (${formatInr(paymentBalance)}).`
                : "Enter less than package price to leave a balance."}
            </span>
          </label>

          <button
            type="button"
            disabled={
              busy ||
              (payRemainingBalance
                ? paymentBalance <= 0
                : !packageId)
            }
            onClick={addSessionsOrPayBalance}
            className="mt-4 rounded-lg border border-teal-800 px-4 py-2 text-sm font-medium text-teal-900 hover:bg-teal-50 disabled:opacity-50"
          >
            {payRemainingBalance ? "Pay balance" : "Add sessions"}
          </button>
        </section>
      ) : null}

      {canSplitPayment && payments.length > 0 ? (
        <section className="rounded-xl border border-stone-200 bg-white p-5">
          <h2 className="font-semibold text-stone-900">Payment history</h2>
          <ul className="mt-3 divide-y divide-stone-100 text-sm">
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
        </section>
      ) : null}

      {canReviewRequests && pendingRequests.length > 0 ? (
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold text-stone-900">
            Medicine, exercise & diet
          </h2>
          <button
            type="button"
            disabled={recommendations.length === 0}
            onClick={() =>
              printRecommendationsLetterhead({
                patientName,
                phone: patientPhone,
                dob: patientDob,
                recommendations,
              })
            }
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Print
          </button>
        </div>
        {recommendations.length === 0 ? (
          <p className="mt-2 text-sm text-stone-500">No recommendations yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {recommendations.map((r) => (
              <li key={r.id} className="rounded-lg bg-stone-50 px-3 py-2 text-sm">
                <p className="font-medium text-teal-900">
                  {recommendationTypeLabel[r.type] ?? r.type}
                </p>
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
                  setRecType(e.target.value as RecommendationType)
                }
                className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              >
                <option value="exercise">Exercise</option>
                <option value="medicine">Medicine</option>
                <option value="diet_lifestyle">Diet/Lifestyle</option>
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
