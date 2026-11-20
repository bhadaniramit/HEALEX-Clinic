import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Prevent rare infinite waits on navigator.locks in some browsers
        lock: async (_name, _acquireTimeout, fn) => fn(),
      },
    },
  );
}
