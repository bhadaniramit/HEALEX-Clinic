# Phase 7 — Deploy HEALEX to Vercel

## 1. Put code on GitHub

From `web/`:

```bash
cd "C:\Users\mcB1290\Bhaiya Clinic\web"
git add .
git status
# Do NOT commit .env.local (already gitignored)
git commit -m "HEALEX clinic app: auth, patients, check-in, sessions"
```

Create a GitHub repo (private recommended), then:

```bash
git remote add origin https://github.com/YOUR_USER/healex-clinic.git
git push -u origin master
```

Or ask Cursor: **“create GitHub repo and push”**.

## 2. Deploy on Vercel

1. [vercel.com](https://vercel.com) → **Add New Project** → import the GitHub repo  
2. Root directory: project root (`web` is the app — if repo is only `web`, leave default)  
3. Framework: Next.js (auto)  
4. Environment variables:

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vnwyvoiphggzdhehypqa.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your `eyJ...` anon key |

5. Deploy  

## 3. Allow Vercel URL in Supabase Auth

1. Supabase → **Authentication** → **URL Configuration**  
2. **Site URL**: your Vercel URL (e.g. `https://healex-clinic.vercel.app`)  
3. **Redirect URLs**: add `https://healex-clinic.vercel.app/**`  

## 4. Test on phone / anywhere

Open the Vercel URL → Sign in as Super Admin → Add patient → Check-in  

No corporate TLS workaround needed on Vercel.

## 5. Optional next

- Custom domain  
- Create Admin / General / Patient users in Supabase Auth + set `profiles.role`  
- Link patient login: set `profiles.patient_id` to their `patients.id`  
- Upgrade Supabase Pro (~$25) when used daily  
