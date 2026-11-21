# Payment split + Total Sale Today

Run once in Supabase **SQL Editor**:

`supabase/payment_split.sql`

This creates:

- `payments` table (money collected)
- `patient_payment_totals` / `record_patient_payment` RPCs
- Updated `create_patient_with_package` / `add_sessions_to_patient` with optional `p_amount_paid`

Existing purchases are backfilled as fully paid so balances start at ₹0.

## App behavior

- **Super Admin:** can enter partial “Amount paid now” when adding a patient/sessions, and **Record payment** toward balance.
- Patient page shows **Total charged**, **Total paid**, **Balance**.
- Tab **Total Sale Today** (Admin + Super Admin): sum of payments recorded today (IST).
