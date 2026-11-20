"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const loginId = email.trim();
      // Staff use email; patients can enter mobile (Auth email = {digits}@patients.healex.local)
      const authEmail = loginId.includes("@")
        ? loginId
        : `${loginId.replace(/\D/g, "")}@patients.healex.local`;

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
          email: authEmail,
          password,
        });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      const session = data.session;
      if (!session) {
        setError("No session returned from Supabase.");
        setLoading(false);
        return;
      }

      // Sync browser session into httpOnly cookies for middleware/server
      const res = await fetch("/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(payload?.error ?? "Could not save session cookie.");
        setLoading(false);
        return;
      }

      window.location.assign("/patients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm">
        <span className="text-stone-700">Email / Mobile No.</span>
        <input
          type="text"
          required
          inputMode="email"
          autoComplete="username"
          placeholder="Email or mobile number"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        />
      </label>
      <label className="block text-sm">
        <span className="text-stone-700">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700"
        />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-900 disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
