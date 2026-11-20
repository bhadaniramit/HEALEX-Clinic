# Checkout feature — run this SQL once

1. Supabase → **SQL Editor** → New query  
2. Paste all of `checkout_migration.sql` → **Run**  
3. Refresh the app → **Checked in today**

After that:
- **Patients checked in** = number currently checked in (not checked out)
- Each row has a **Checkout** button — removes them from the list and decreases the count
