import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  normalizePatientPhone,
  patientAuthEmail,
  patientDefaultPassword,
} from "@/lib/phone";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      dob?: string;
      address?: string;
      phone?: string;
      packageId?: string;
    };

    const name = (body.name ?? "").trim();
    const dob = body.dob ?? "";
    const address = (body.address ?? "").trim();
    const packageId = body.packageId ?? "";
    const phone10 = normalizePatientPhone(body.phone ?? "");

    if (!name || !dob || !address || !packageId) {
      return NextResponse.json(
        { error: "Name, DOB, address, and package are required." },
        { status: 400 },
      );
    }

    if (!phone10) {
      return NextResponse.json(
        { error: "Enter a valid 10-digit mobile number." },
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

    const { data: patient, error: rpcError } = await supabase.rpc(
      "create_patient_with_package",
      {
        p_name: name,
        p_dob: dob,
        p_address: address,
        p_phone: phone10,
        p_package_id: packageId,
      },
    );

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 400 });
    }

    const patientRow = patient as { id: string };
    const authEmail = patientAuthEmail(phone10);
    const password = patientDefaultPassword(phone10);

    const admin = createAdminClient();
    const { data: created, error: authError } =
      await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          role: "patient",
          patient_id: patientRow.id,
        },
      });

    if (authError || !created.user) {
      return NextResponse.json(
        {
          error:
            authError?.message ??
            "Patient saved, but login account could not be created.",
          patientId: patientRow.id,
          loginHint: {
            username: phone10,
            password,
            note: "Password is last 6 digits. Auth min password length must be 6 in Supabase.",
          },
        },
        { status: 207 },
      );
    }

    // Patients are NOT kept in profiles — identity comes from patients.phone
    // Remove auto-created profile row from Auth signup trigger (if any).
    await admin.from("profiles").delete().eq("id", created.user.id);

    return NextResponse.json({
      patientId: patientRow.id,
      login: {
        username: phone10,
        password,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
