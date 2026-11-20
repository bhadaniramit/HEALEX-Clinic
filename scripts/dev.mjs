/**
 * Local Windows/corporate networks often intercept HTTPS and break Node's
 * certificate store (UNABLE_TO_GET_ISSUER_CERT_LOCALLY → "fetch failed").
 * Browsers still work. This flag is for local Next.js → Supabase only.
 * Do NOT use this pattern on production hosting (Vercel has normal certs).
 */
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { spawn } = await import("node:child_process");
const child = spawn("npx", ["next", "dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
