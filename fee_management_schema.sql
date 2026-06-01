-- Fee Management Module Schema
-- Run this in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.incubation_fee_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.applications(id) on delete cascade,
  monthly_fee numeric(12,2) not null check (monthly_fee >= 0),
  refundable_deposit numeric(12,2) not null default 0 check (refundable_deposit >= 0),
  deposit_collection_date date,
  deposit_status text not null default 'pending' check (deposit_status in ('pending', 'collected', 'partially_refunded', 'refunded')),
  start_date date not null,
  due_day int not null default 5 check (due_day between 1 and 28),
  grace_period_days int not null default 0 check (grace_period_days >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id)
);

create table if not exists public.incubation_fee_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.applications(id) on delete cascade,
  invoice_number text not null unique,
  billing_month date not null,
  amount numeric(12,2) not null check (amount >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'partially_paid', 'paid', 'overdue')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, billing_month)
);

create table if not exists public.company_deposits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.applications(id) on delete cascade,
  deposit_amount numeric(12,2) not null default 0 check (deposit_amount >= 0),
  amount_collected numeric(12,2) not null default 0 check (amount_collected >= 0),
  amount_refunded numeric(12,2) not null default 0 check (amount_refunded >= 0),
  balance_amount numeric(12,2) not null default 0,
  collection_date date,
  refund_date date,
  status text not null default 'pending' check (status in ('pending', 'collected', 'partially_refunded', 'refunded')),
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  message text not null,
  recipient_type text not null check (recipient_type in ('all', 'selected', 'overdue', 'pending_deposits', 'company_specific')),
  company_id uuid references public.applications(id) on delete set null,
  sent_by text,
  sent_at timestamptz not null default now()
);

create table if not exists public.fee_collections (
  id uuid primary key default gen_random_uuid(),
  receipt_number text unique,
  company_id uuid not null references public.applications(id) on delete cascade,
  collection_type text not null check (collection_type in ('monthly_fee', 'refundable_deposit', 'additional_charges', 'penalty_charges', 'other_fees', 'deposit_refund')),
  invoice_id uuid references public.incubation_fee_invoices(id) on delete set null,
  deposit_id uuid references public.company_deposits(id) on delete set null,
  collection_date date not null,
  amount_collected numeric(12,2) not null check (amount_collected >= 0),
  payment_mode text not null check (payment_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
  transaction_reference text,
  collected_by text,
  remarks text,
  attachment_url text,
  status text not null default 'recorded' check (status in ('recorded', 'cancelled')),
  created_at timestamptz not null default now()
);

-- Upgrade existing databases created from older schema revisions.
alter table public.incubation_fee_settings
  add column if not exists grace_period_days int not null default 0;

alter table public.incubation_fee_invoices
  add column if not exists updated_at timestamptz not null default now();

alter table public.fee_collections
  add column if not exists status text not null default 'recorded';

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'fee_collections_collection_type_check'
      and conrelid = 'public.fee_collections'::regclass
  ) then
    alter table public.fee_collections drop constraint fee_collections_collection_type_check;
  end if;

  alter table public.fee_collections
    add constraint fee_collections_collection_type_check
    check (collection_type in ('monthly_fee', 'refundable_deposit', 'additional_charges', 'penalty_charges', 'other_fees', 'deposit_refund'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'fee_collections_status_check'
      and conrelid = 'public.fee_collections'::regclass
  ) then
    alter table public.fee_collections drop constraint fee_collections_status_check;
  end if;

  alter table public.fee_collections
    add constraint fee_collections_status_check
    check (status in ('recorded', 'cancelled'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'incubation_fee_settings_grace_period_days_check'
      and conrelid = 'public.incubation_fee_settings'::regclass
  ) then
    alter table public.incubation_fee_settings drop constraint incubation_fee_settings_grace_period_days_check;
  end if;

  alter table public.incubation_fee_settings
    add constraint incubation_fee_settings_grace_period_days_check
    check (grace_period_days >= 0);
exception
  when duplicate_object then null;
end
$$;

create index if not exists idx_fee_settings_company on public.incubation_fee_settings(company_id);
create index if not exists idx_fee_invoices_company on public.incubation_fee_invoices(company_id);
create index if not exists idx_fee_invoices_status_due on public.incubation_fee_invoices(status, due_date);
create index if not exists idx_company_deposits_company on public.company_deposits(company_id);
create index if not exists idx_fee_collections_company on public.fee_collections(company_id);
create index if not exists idx_fee_collections_type_date on public.fee_collections(collection_type, collection_date);
create index if not exists idx_notifications_company_date on public.notifications(company_id, sent_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_fee_settings_updated_at on public.incubation_fee_settings;
create trigger trg_fee_settings_updated_at
before update on public.incubation_fee_settings
for each row
execute function public.set_updated_at();

drop trigger if exists trg_company_deposits_updated_at on public.company_deposits;
create trigger trg_company_deposits_updated_at
before update on public.company_deposits
for each row
execute function public.set_updated_at();

drop trigger if exists trg_fee_invoices_updated_at on public.incubation_fee_invoices;
create trigger trg_fee_invoices_updated_at
before update on public.incubation_fee_invoices
for each row
execute function public.set_updated_at();

alter table public.incubation_fee_settings enable row level security;
alter table public.incubation_fee_invoices enable row level security;
alter table public.company_deposits enable row level security;
alter table public.notifications enable row level security;
alter table public.fee_collections enable row level security;

drop policy if exists fee_settings_all on public.incubation_fee_settings;
drop policy if exists fee_invoices_all on public.incubation_fee_invoices;
drop policy if exists company_deposits_all on public.company_deposits;
drop policy if exists notifications_all on public.notifications;
drop policy if exists fee_collections_all on public.fee_collections;

drop policy if exists fee_settings_admin_all on public.incubation_fee_settings;
drop policy if exists fee_settings_company_read on public.incubation_fee_settings;
drop policy if exists fee_invoices_admin_all on public.incubation_fee_invoices;
drop policy if exists fee_invoices_company_read on public.incubation_fee_invoices;
drop policy if exists company_deposits_admin_all on public.company_deposits;
drop policy if exists company_deposits_company_read on public.company_deposits;
drop policy if exists notifications_admin_all on public.notifications;
drop policy if exists notifications_company_read on public.notifications;
drop policy if exists fee_collections_admin_all on public.fee_collections;
drop policy if exists fee_collections_company_read on public.fee_collections;

create policy fee_settings_admin_all on public.incubation_fee_settings
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy fee_settings_company_read on public.incubation_fee_settings
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = incubation_fee_settings.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );

create policy fee_invoices_admin_all on public.incubation_fee_invoices
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy fee_invoices_company_read on public.incubation_fee_invoices
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = incubation_fee_invoices.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );

create policy company_deposits_admin_all on public.company_deposits
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy company_deposits_company_read on public.company_deposits
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = company_deposits.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );

create policy notifications_admin_all on public.notifications
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy notifications_company_read on public.notifications
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and (
      recipient_type = 'all'
      or exists (
        select 1 from public.applications a
        where a.id = notifications.company_id
          and lower(a.email) = lower(auth.jwt() ->> 'email')
          and lower(a.status) = 'approved'
      )
    )
  );

create policy fee_collections_admin_all on public.fee_collections
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy fee_collections_company_read on public.fee_collections
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = fee_collections.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );
