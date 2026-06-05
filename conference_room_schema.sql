-- Conference Room Booking Schema
-- Run this in Supabase SQL Editor

create table if not exists public.conference_bookings (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.applications(id) on delete cascade,
  title           text not null,
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  status          text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason text,
  requested_by    text,          -- email of requester
  reviewed_by     text,          -- admin email
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Ensure end_time > start_time
  constraint chk_booking_times check (end_time > start_time)
);

create index if not exists idx_conf_bookings_time   on public.conference_bookings(start_time, end_time);
create index if not exists idx_conf_bookings_status on public.conference_bookings(status);
create index if not exists idx_conf_bookings_company on public.conference_bookings(company_id);

drop trigger if exists trg_conf_bookings_updated_at on public.conference_bookings;
create trigger trg_conf_bookings_updated_at
before update on public.conference_bookings
for each row execute function public.set_updated_at();

-- RLS
alter table public.conference_bookings enable row level security;

-- Admins can do everything
drop policy if exists conf_bookings_admin_all on public.conference_bookings;
create policy conf_bookings_admin_all on public.conference_bookings
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Companies can read all approved bookings (to see calendar)
drop policy if exists conf_bookings_company_read_approved on public.conference_bookings;
create policy conf_bookings_company_read_approved on public.conference_bookings
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and (
      status = 'approved'
      or exists (
        select 1 from public.applications a
        where a.id = conference_bookings.company_id
          and lower(a.email) = lower(auth.jwt() ->> 'email')
          and lower(a.status) = 'approved'
      )
    )
  );

-- Companies can insert their own bookings
drop policy if exists conf_bookings_company_insert on public.conference_bookings;
create policy conf_bookings_company_insert on public.conference_bookings
  for insert
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = conference_bookings.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );

-- Companies can cancel their own pending bookings
drop policy if exists conf_bookings_company_cancel on public.conference_bookings;
create policy conf_bookings_company_cancel on public.conference_bookings
  for update
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and status = 'pending'
    and exists (
      select 1 from public.applications a
      where a.id = conference_bookings.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );
