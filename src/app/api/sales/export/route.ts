import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import {
  endExclusiveOfIstDateIso,
  startOfIstDateIso,
} from "@/lib/date-ist";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const type = url.searchParams.get("type"); // balance | paid
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

  if (type !== "balance" && type !== "paid") {
    return NextResponse.json(
      { error: "type must be balance or paid." },
      { status: 400 },
    );
  }
  if (!YMD.test(from) || !YMD.test(to)) {
    return NextResponse.json(
      { error: "from and to must be YYYY-MM-DD." },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: "from date must be on or before to date." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const rangeStart = startOfIstDateIso(from);
  const rangeEnd = endExclusiveOfIstDateIso(to);

  if (type === "paid") {
    const { data, error } = await supabase
      .from("payments")
      .select("amount, patient_id, patients(name)")
      .gte("created_at", rangeStart)
      .lt("created_at", rangeEnd);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const byPatient = new Map<string, { name: string; paid: number }>();
    for (const row of data ?? []) {
      const id = String(row.patient_id);
      const related = row.patients as
        | { name?: string }
        | { name?: string }[]
        | null;
      const patient = Array.isArray(related) ? related[0] : related;
      const name = patient?.name ?? "Patient";
      const prev = byPatient.get(id);
      const amount = Number(row.amount) || 0;
      if (prev) {
        prev.paid += amount;
      } else {
        byPatient.set(id, { name, paid: amount });
      }
    }

    const rows = Array.from(byPatient.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((r) => [r.name, r.paid.toFixed(2)]);

    const csv = toCsv(["Patient Name", "Amount Paid"], rows);
    const filename = `patient-amount-paid_${from}_to_${to}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  // balance: patients with payment activity in range → current name + balance
  const { data: payRows, error: payError } = await supabase
    .from("payments")
    .select("patient_id")
    .gte("created_at", rangeStart)
    .lt("created_at", rangeEnd);

  if (payError) {
    return NextResponse.json({ error: payError.message }, { status: 400 });
  }

  const patientIds = [
    ...new Set(
      ((payRows as { patient_id: string }[] | null) ?? []).map(
        (r) => r.patient_id,
      ),
    ),
  ];

  if (patientIds.length === 0) {
    const csv = toCsv(["Patient Name", "Balance"], []);
    const filename = `patient-balance_${from}_to_${to}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const [
    { data: patients, error: patientError },
    { data: purchaseRows, error: purchaseError },
    { data: allPayRows, error: allPayError },
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id, name")
      .in("id", patientIds)
      .order("name", { ascending: true }),
    supabase
      .from("purchases")
      .select("patient_id, amount")
      .in("patient_id", patientIds),
    supabase
      .from("payments")
      .select("patient_id, amount")
      .in("patient_id", patientIds),
  ]);

  if (patientError || purchaseError || allPayError) {
    return NextResponse.json(
      {
        error:
          patientError?.message ??
          purchaseError?.message ??
          allPayError?.message ??
          "Export failed.",
      },
      { status: 400 },
    );
  }

  const charged = new Map<string, number>();
  for (const r of purchaseRows ?? []) {
    charged.set(
      r.patient_id as string,
      (charged.get(r.patient_id as string) ?? 0) + Number(r.amount),
    );
  }
  const paid = new Map<string, number>();
  for (const r of allPayRows ?? []) {
    paid.set(
      r.patient_id as string,
      (paid.get(r.patient_id as string) ?? 0) + Number(r.amount),
    );
  }

  const rows: Array<[string, string]> = (patients ?? []).map((p) => {
    const balance =
      (charged.get(p.id) ?? 0) - (paid.get(p.id) ?? 0);
    return [p.name as string, balance.toFixed(2)];
  });

  const csv = toCsv(["Patient Name", "Balance"], rows);
  const filename = `patient-balance_${from}_to_${to}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
