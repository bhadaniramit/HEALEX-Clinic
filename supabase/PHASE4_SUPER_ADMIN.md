# Phase 4 — Create Super Admin (Doctor)

Do this once in the Supabase dashboard.

## 1. Enable Email auth

1. Supabase → **Authentication** → **Providers** → **Email**
2. Ensure Email is **enabled**
3. For easier testing you may disable “Confirm email” (Authentication → Providers → Email → Confirm email = off)

## 2. Create the doctor user

1. **Authentication** → **Users** → **Add user** → **Create new user**
2. Enter doctor **email** + **password**
3. Check **Auto Confirm User**
4. Create user

The `profiles` row is created automatically by our trigger (default role = `general`).

## 3. Promote to Super Admin

1. **Table Editor** → **profiles**
2. Find the doctor’s row (same UUID as Auth user)
3. Set **role** = `super_admin`
4. Set **full_name** = doctor’s name (optional)
5. Save

## 4. Sign in to the app

```bash
cd "C:\Users\mcB1290\Bhaiya Clinic\web"
npm run dev
```

Open http://localhost:3000/login → use the doctor email/password  
→ you should land on **/patients**

## Troubleshooting

| Problem | Fix |
|---------|-----|
| **`fetch failed` / SSL error** | Corporate proxy missing CA for Node. `npm run dev` uses a local TLS workaround (`scripts/dev.mjs`). Vercel production does not need this. |
| Invalid API key / Auth fails | Use legacy **anon** `eyJ...` key in `web/.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| No profiles row | Re-check trigger; or insert manually: `id` = auth user id, `role` = `super_admin` |
| Redirect loop | Clear site cookies for localhost:3000 and try again |
