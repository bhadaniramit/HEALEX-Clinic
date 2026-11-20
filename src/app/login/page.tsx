import { redirect } from "next/navigation";
import { getProfile, homeForRole } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const profile = await getProfile();
  if (profile) redirect(homeForRole(profile.role));

  const params = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
          HEALEX
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Staff and patients use the account created for them by the clinic.
        </p>
        {params.error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
            {params.error}
          </p>
        ) : null}
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
