-- Run this whole file once in Supabase > SQL Editor.
-- Then add yourself as admin (see bottom).

create extension if not exists pgcrypto;

-- ===== Admin allow-list =====
create table if not exists public.admins (email text primary key);
alter table public.admins enable row level security;  -- no policies: nobody can read it directly

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins
                 where lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ===== Projects =====
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  short_description text not null check (char_length(short_description) between 1 and 300),
  full_description text not null default '',
  category text not null check (category in
    ('Web Development','Android Applications','AI and Machine Learning','Software Development','Other')),
  tech text[] not null default '{}',
  thumbnail_path text,
  screenshots text[] not null default '{}',
  live_url text check (live_url is null or live_url ~* '^https?://'),
  apk_path text,
  apk_version text,
  apk_size_bytes bigint,
  release_date date,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_list_idx on public.projects (status, featured desc, updated_at desc);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists projects_touch on public.projects;
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

alter table public.projects enable row level security;
create policy "public reads published" on public.projects for select
  using (status = 'published' or public.is_admin());
create policy "admin insert" on public.projects for insert to authenticated with check (public.is_admin());
create policy "admin update" on public.projects for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete" on public.projects for delete to authenticated using (public.is_admin());

-- ===== Contact messages (stored in DB; read them in Supabase > Table Editor) =====
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200),
  subject text not null check (char_length(subject) between 1 and 150),
  message text not null check (char_length(message) between 1 and 5000),
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
create policy "anyone can send" on public.messages for insert to anon, authenticated with check (true);
create policy "admin reads" on public.messages for select to authenticated using (public.is_admin());
create policy "admin deletes" on public.messages for delete to authenticated using (public.is_admin());

-- ===== Storage buckets =====
-- images: 5 MB max. apks: 100 MB max (Supabase Free plan caps any file at 50 MB; see README).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('images', 'images', true, 5242880,   array['image/jpeg','image/png','image/webp']),
  ('apks',   'apks',   true, 104857600, array['application/vnd.android.package-archive','application/octet-stream'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types, public = excluded.public;

-- Public buckets let anyone download by URL. Only the admin can write/delete/list.
create policy "admin storage select" on storage.objects for select to authenticated
  using (bucket_id in ('images','apks') and public.is_admin());
create policy "admin storage insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('images','apks') and public.is_admin());
create policy "admin storage update" on storage.objects for update to authenticated
  using (bucket_id in ('images','apks') and public.is_admin());
create policy "admin storage delete" on storage.objects for delete to authenticated
  using (bucket_id in ('images','apks') and public.is_admin());

-- ===== Initial projects (no APKs, no invented links) =====
insert into public.projects (name, short_description, full_description, category, tech, live_url, status, featured) values
 ('HoodaMart', 'A modern e-commerce website with product browsing and shopping interface features.',
  'A modern e-commerce website with product browsing and shopping interface features.',
  'Web Development', '{}', 'https://hoodamart001.netlify.app', 'published', true),
 ('KisanConnect', 'A farmer-focused mobile application developed using Flutter and Firebase, with Firebase-powered notification functionality.',
  'A farmer-focused mobile application developed using Flutter and Firebase, with Firebase-powered notification functionality.',
  'Android Applications', array['Flutter','Firebase'], null, 'published', true),
 ('HoodaHomes', 'A home customization and visualization project focused on interactive design and user experience.',
  'A home customization and visualization project focused on interactive design and user experience.',
  'Other', '{}', null, 'published', false);

-- ===== LAST STEP: make yourself the admin (replace with the email you created in Auth > Users) =====
-- insert into public.admins (email) values ('your-email@example.com');
