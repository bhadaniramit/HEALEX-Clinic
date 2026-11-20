import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <main className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium tracking-wide text-teal-800 uppercase">
          HEALEX
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-900">
          Pain & Lifestyle Clinic
        </h1>
        <p className="mt-3 text-sm text-stone-600">
          Sign in to search patients, check in sessions, or view your balance.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block w-full rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900"
        >
          Sign in
        </Link>
      </main>
    </div>
  );
}
