-- Staff Payments Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. PAY counter (SIIF-PAY-2026-00001)
-- ============================================================
insert into public.siif_counters (series, year, last_seq)
values ('PAY', 2026, 0)
on conflict (series, year) do nothing;

-- ============================================================
-- 2. Staff table
-- ============================================================
create table if not exists public.siif_staff (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  designation  text not null,
  payment_type text not null check (payment_type in ('salary', 'honorarium')),
  amount       numeric(12,2) not null check (amount >= 0),
  bank_account text,
  ifsc         text,
  email        text,
  phone        text,
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_staff_updated_at on public.siif_staff;
create trigger trg_staff_updated_at
before update on public.siif_staff
for each row execute function public.set_updated_at();

-- Seed CEO (honorarium)
insert into public.siif_staff (name, designation, payment_type, amount, notes)
values ('Sarju S', 'Chief Executive Officer', 'honorarium', 7000, 'Amount set per disbursement')
on conflict do nothing;

-- ============================================================
-- 3. Staff payments table (outgoing payments from SIIF)
-- ============================================================
create table if not exists public.siif_staff_payments (
  id             uuid primary key default gen_random_uuid(),
  payment_number text not null unique,          -- SIIF-PAY-2026-00001
  staff_id       uuid not null references public.siif_staff(id) on delete restrict,
  payment_type   text not null check (payment_type in ('salary', 'honorarium')),
  payment_month  date not null,                 -- First day of the month (2026-06-01)
  amount         numeric(12,2) not null check (amount > 0),
  payment_mode   text not null check (payment_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
  payment_date   date not null,
  transaction_reference text,
  paid_by        text,
  remarks        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

drop trigger if exists trg_staff_payments_updated_at on public.siif_staff_payments;
create trigger trg_staff_payments_updated_at
before update on public.siif_staff_payments
for each row execute function public.set_updated_at();

create index if not exists idx_staff_payments_staff on public.siif_staff_payments(staff_id);
create index if not exists idx_staff_payments_month on public.siif_staff_payments(payment_month desc);

-- RLS
alter table public.siif_staff enable row level security;
alter table public.siif_staff_payments enable row level security;

drop policy if exists staff_admin_all on public.siif_staff;
create policy staff_admin_all on public.siif_staff
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists staff_payments_admin_all on public.siif_staff_payments;
create policy staff_payments_admin_all on public.siif_staff_payments
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');
