# Puneet Portfolio

React + Vite + Supabase (Auth, Postgres, Storage). Public site at `/`, admin dashboard at `/admin`.

## Status (read first)
This code was written but **not built or run** in the environment that produced it (no network, no Supabase project).
Run `npm install && npm run build` yourself, then follow the checklist at the bottom. The reference video was not
received, so the design is an original dark "aurora" style; send frames or a description to match it more closely.

## 1. Create the Supabase project
supabase.com > New project. Wait until it finishes provisioning.

## 2. Tables, security (RLS) and storage
Supabase > SQL Editor > paste all of `supabase/schema.sql` > Run. This creates:
- `projects`, `messages`, `admins` tables with Row Level Security
- Buckets `images` (5 MB, JPG/PNG/WebP) and `apks` (100 MB, .apk), public-read, admin-only write/delete
- The 3 initial projects (HoodaMart, KisanConnect, HoodaHomes) with no APKs

## 3. Create your admin account (secure)
1. Authentication > Providers > Email: keep enabled. Authentication > Sign In / Providers: **turn OFF "Allow new users to sign up"**.
2. Authentication > Users > Add user > enter your email and a strong password > tick "Auto confirm user".
3. SQL Editor: `insert into public.admins (email) values ('your-email@example.com');`
Only emails in `admins` can create/edit/delete projects or upload files. This is enforced by the database, not the UI.

## 4. Environment variables
Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(Project Settings > API). Use only the **anon** key. Never use the `service_role` key.

## 5. Run locally
`npm install` then `npm run dev`.

## 6. Deploy (Netlify or Vercel)
Push to GitHub > import the repo. Build command `npm run build`, output `dist`. Add the two env variables in the
host's settings. SPA routing (`/admin`) is already configured by `netlify.toml`, `public/_redirects`, `vercel.json`.
In Supabase > Authentication > URL Configuration, set Site URL to your deployed address.

## 7. Upload an APK
Open `yoursite/admin` on your phone > log in > Edit (or Add New Project) > choose the `.apk`, set version > Save.
The new file uploads first; the old APK is deleted only after the database update succeeds.

## 8. Test APK download on Android
Open the public site in Chrome on Android > project > Download APK. The link serves the real file from Supabase
Storage with a forced-download header. Android will ask you to allow installing from Chrome; that is normal for APKs.

## Limits and notes
- **File size:** Supabase Free plan limits every file to 50 MB (Storage > Settings). Larger APKs need the Pro plan
  or a smaller build. The schema allows 100 MB per APK.
- **Contact form:** messages are saved to the `messages` table (read in Supabase > Table Editor). It does not send
  email. For email alerts, add a Database Webhook or Edge Function with an email provider (e.g. Resend).
- **Privacy of drafts:** draft rows are hidden by RLS. Files in public buckets sit at unguessable UUID paths,
  but anyone who knows a file URL can open it.
- Education, skills and about text are in `src/Portfolio.jsx` (add your college/year there).

## Test checklist (not yet verified)
public site loads; login works; a non-admin account is refused; add / edit / delete project; image and APK upload;
APK download; replace APK; draft hidden from public; no GitHub links anywhere; phone layout; data persists after refresh.
