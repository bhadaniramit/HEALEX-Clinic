# Patient auto-login on create

When a patient is saved:

- **Username (login):** 10-digit mobile number  
- **Password:** last 4 digits of that mobile  
- Auth email stored as: `{mobile}@patients.healex.local`
- **No `profiles` row** for patients — app reads identity from **`patients`** by phone

Also run: `patient_no_profile_rls.sql` (so RLS `my_patient_id()` uses phone from JWT email).

## Required setup

### 1. Service role key (server only)

1. Supabase → **Project Settings → API** → copy **`service_role`** key  
2. Local `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

3. Vercel → Project → **Settings → Environment Variables** → add the same  
   (Production + Preview). **Never** prefix with `NEXT_PUBLIC_`.

### 2. Allow 4-character passwords

Supabase default min password length is often **6**. Last 4 digits need **4**:

**Authentication → Providers → Email → Minimum password length → 4**

(Or Policies / password settings in your Supabase Auth UI.)

Redeploy after adding the env var.
