-- Company Payment Submissions Table
-- Run this in Supabase SQL Editor after fee_management_schema.sql

create table if not exists public.company_payment_submissions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.applications(id) on delete cascade,
  invoice_id uuid references public.incubation_fee_invoices(id) on delete set null,
  amount_paid numeric(12,2) not null check (amount_paid > 0),
  payment_mode text not null check (payment_mode in ('cash', 'bank_transfer', 'upi', 'cheque', 'other')),
  transaction_reference text,
  payment_date date not null,
  remarks text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  receipt_number text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_submissions_company on public.company_payment_submissions(company_id);
create index if not exists idx_payment_submissions_status on public.company_payment_submissions(status);

-- RLS policies
alter table public.company_payment_submissions enable row level security;

drop policy if exists payment_submissions_admin_all on public.company_payment_submissions;
drop policy if exists payment_submissions_company_own on public.company_payment_submissions;

create policy payment_submissions_admin_all on public.company_payment_submissions
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy payment_submissions_company_own on public.company_payment_submissions
  for all
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = company_payment_submissions.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  )
  with check (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'company'
    and exists (
      select 1 from public.applications a
      where a.id = company_payment_submissions.company_id
        and lower(a.email) = lower(auth.jwt() ->> 'email')
        and lower(a.status) = 'approved'
    )
  );
