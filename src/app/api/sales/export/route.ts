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
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";

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

  // Patients with payment or purchase activity in the selected range
  const [{ data: payInRange, error: payRangeError }, { data: purchInRange, error: purchRangeError }] =
    await Promise.all([
      supabase
        .from("payments")
        .select("patient_id")
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd),
      supabase
        .from("purchases")
        .select("patient_id")
        .gte("created_at", rangeStart)
        .lt("created_at", rangeEnd),
    ]);

  if (payRangeError || purchRangeError) {
    return NextResponse.json(
      {
        error:
          payRangeError?.message ??
          purchRangeError?.message ??
          "Export failed.",
      },
      { status: 400 },
    );
  }

  const patientIds = [
    ...new Set([
      ...((payInRange as { patient_id: string }[] | null) ?? []).map(
        (r) => r.patient_id,
      ),
      ...((purchInRange as { patient_id: string }[] | null) ?? []).map(
        (r) => r.patient_id,
      ),
    ]),
  ];

  const headers = [
    "Patient Name",
    "Total Amount Charged",
    "Total Amount Paid",
    "Total Balance Amount",
  ];

  if (patientIds.length === 0) {
    const csv = toCsv(headers, []);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="patient-payment-details_${from}_to_${to}.csv"`,
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
    const id = r.patient_id as string;
    charged.set(id, (charged.get(id) ?? 0) + Number(r.amount));
  }
  const paid = new Map<string, number>();
  for (const r of allPayRows ?? []) {
    const id = r.patient_id as string;
    paid.set(id, (paid.get(id) ?? 0) + Number(r.amount));
  }

  const rows = (patients ?? []).map((p) => {
    const totalCharged = charged.get(p.id) ?? 0;
    const totalPaid = paid.get(p.id) ?? 0;
    const balance = totalCharged - totalPaid;
    return [
      p.name as string,
      totalCharged.toFixed(2),
      totalPaid.toFixed(2),
      balance.toFixed(2),
    ];
  });

  const csv = toCsv(headers, rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="patient-payment-details_${from}_to_${to}.csv"`,
    },
  });
}
