# HEALEX — Pain & Lifestyle Clinic (Session Handoff)

**Brand (UI):** HEALEX  
**Tagline / heading:** Pain & Lifestyle Clinic  
**App folder (current):** `C:\Users\mcB1290\Healex\HEALEX-Clinic`  
**Previous folder (archive):** `C:\Users\mcB1290\Bhaiya Clinic\web`  

**GitHub:** https://github.com/bhadaniramit/HEALEX-Clinic  
**Production URL:** https://healex-clinic.vercel.app/  
**Supabase:** PT Clinic Project · `vnwyvoiphggzdhehypqa` · ap-south-1 Mumbai  
**URL:** `https://vnwyvoiphggzdhehypqa.supabase.co`

## Status
- Stack LOCKED: Supabase + Next.js + Vercel  
- Live on Vercel  
- Edit patient + unique phone: committed locally as `147afd5` on `main` (ahead of origin) and branch `feature/edit-patient-unique-phone`  
- Env: `.env.local` copied (gitignored)

## Pending for Edit feature
1. Run `supabase/unique_phone_and_edit.sql` in Supabase SQL Editor (if not already)  
2. Push with **bhadaniramit** account (PAT needs Contents: Read and write):  
   `git push -u origin feature/edit-patient-unique-phone`  
   or merge to main and `git push origin main`  
3. Vercel auto-redeploys after push  

## Locked UX
- Never load all patients — search only  
- One check-in per patient per IST day  
- Checked-in today tab: currently checked in + total today + checkout  
