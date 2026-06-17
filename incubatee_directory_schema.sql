-- Incubatee Directory Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Storage bucket for passport photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('incubatee-photos', 'incubatee-photos', false)
on conflict (id) do nothing;

-- Allow company users to upload their own photos
drop policy if exists incubatee_photos_company_upload on storage.objects;
create policy incubatee_photos_company_upload on storage.objects
  for insert
  with check (
    bucket_id = 'incubatee-photos'
    and (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
  );

-- Allow authenticated users to read photos
drop policy if exists incubatee_photos_read on storage.objects;
create policy incubatee_photos_read on storage.objects
  for select
  using (
    bucket_id = 'incubatee-photos'
    and auth.role() = 'authenticated'
  );

-- ============================================================
-- 2. Counter for incubatee IDs (YY + SIIF + 3-digit seq)
-- ============================================================
-- Uses the existing siif_counters table
insert into public.siif_counters (series, year, last_seq)
values ('EMP', extract(year from now())::int, 0)
on conflict (series, year) do nothing;

-- ============================================================
-- 3. Incubatees table
-- ============================================================
create table if not exists public.incubatees (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.applications(id) on delete cascade,
  incubatee_id    text unique,            -- e.g. 26SIIF001 (set on approval)

  -- Personal details
  full_name       text not null,
  designation     text not null,
  email           text,
  mobile          text,
  gender          text check (gender in ('male','female','other')),
  date_of_birth   date,
  address         text,

  -- ID proof
  id_type         text check (id_type in ('aadhaar','pan','passport','voter_id','driving_license')),
  id_number       text,

  -- Photo
  photo_url       text,                  -- Supabase storage path

  -- Workflow
  status          text not null default 'pending'
                  check (status in ('pending','approved','rejected')),
  rejection_reason text,
  submitted_by    text,                  -- company user email
  reviewed_by     text,                  -- admin email
  reviewed_at     timestamptz,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_incubatees_company  on public.incubatees(company_id);
create index if not exists idx_incubatees_status   on public.incubatees(status);
create index if not exists idx_incubatees_emp_id   on public.incubatees(incubatee_id);

drop trigger if exists trg_incubatees_updated_at on public.incubatees;
create trigger trg_incubatees_updated_at
before update on public.incubatees
for each row execute function public.set_updated_at();

-- ============================================================
-- 4. RLS
-- ============================================================
alter table public.incubatees enable row level security;

-- Admins: full access
drop policy if exists incubatees_admin_all on public.incubatees;
create policy incubatees_admin_all on public.incubatees
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Companies: read their own, insert for their own company
drop policy if exists incubatees_company_read on public.incubatees;
create policy incubatees_company_read on public.incubatees
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = incubatees.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );

drop policy if exists incubatees_company_insert on public.incubatees;
create policy incubatees_company_insert on public.incubatees
  for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = incubatees.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );

drop policy if exists incubatees_company_update on public.incubatees;
create policy incubatees_company_update on public.incubatees
  for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and status = 'pending'
    and exists (
      select 1 from public.applications a
      where a.id = incubatees.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );
