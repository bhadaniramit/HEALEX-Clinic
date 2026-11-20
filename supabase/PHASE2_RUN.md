# Phase 2 — Run this in Supabase

## Steps

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → project **vnwyvoiphggzdhehypqa**
2. Go to **SQL Editor** → **New query**
3. Open local file: `web/supabase/schema.sql`
4. Copy **all** contents → paste into SQL Editor → click **Run**
5. Confirm success (green). If re-run later, the script is mostly idempotent.

## Verify

In **Table Editor**, you should see:

- `profiles`
- `session_packages` (3 seeded packages: 5 / 10 / 20)
- `patients`
- `visits`
- `purchases`
- `session_requests`
- `recommendations`

In **Database → Functions**, you should see:

- `check_in_patient`
- `add_sessions_to_patient`
- `create_patient_with_package`
- `request_more_sessions`
- `approve_session_request`
- `reject_session_request`
- `search_patients`

## After Phase 2 (Phase 4 preview)

1. **Authentication → Users → Add user** (doctor email/password)
2. In **Table Editor → profiles**, set that user’s `role` to `super_admin`
3. (Optional) Edit package prices in `session_packages`

## Seed package prices (INR defaults)

| Package | Sessions | Price |
|---------|----------|-------|
| 5 Sessions | 5 | 2500 |
| 10 Sessions | 10 | 4500 |
| 20 Sessions | 20 | 8000 |

Change anytime in Table Editor.
