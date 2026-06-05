-- Sequential Numbering Schema
-- Run this in Supabase SQL Editor

-- ============================================================
-- 1. Counter table (one row per series per year)
-- ============================================================
create table if not exists public.siif_counters (
  id         uuid primary key default gen_random_uuid(),
  series     text not null,   -- 'INV' or 'RCPT'
  year       int  not null,
  last_seq   int  not null default 0,
  unique(series, year)
);

-- Seed counters for 2026 (will be updated after re-numbering below)
insert into public.siif_counters (series, year, last_seq)
values ('INV', 2026, 0), ('RCPT', 2026, 0)
on conflict (series, year) do nothing;

-- RLS: only service role can write (API routes use service role key)
alter table public.siif_counters enable row level security;

drop policy if exists counters_admin_all on public.siif_counters;
create policy counters_admin_all on public.siif_counters
  for all
  using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- ============================================================
-- 2. Atomic next-number function (safe for concurrent calls)
-- ============================================================
create or replace function public.next_siif_number(p_series text, p_year int)
returns int
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  -- Upsert + lock the row, increment atomically
  insert into public.siif_counters (series, year, last_seq)
  values (p_series, p_year, 1)
  on conflict (series, year)
  do update set last_seq = siif_counters.last_seq + 1
  returning last_seq into v_seq;

  return v_seq;
end;
$$;

-- ============================================================
-- 3. Re-number existing invoices: SIIF-INV-2026-00001 ...
--    Ordered by created_at so earliest invoice gets 00001
-- ============================================================
do $$
declare
  r record;
  seq int := 0;
  new_number text;
  yr int;
begin
  for r in
    select id, created_at
    from public.incubation_fee_invoices
    where status != 'void'
    order by created_at asc
  loop
    seq := seq + 1;
    yr  := extract(year from r.created_at)::int;
    new_number := 'SIIF-INV-' || yr || '-' || lpad(seq::text, 5, '0');

    update public.incubation_fee_invoices
    set invoice_number = new_number
    where id = r.id;
  end loop;

  -- Update counter to current max so next invoice continues the sequence
  update public.siif_counters
  set last_seq = seq
  where series = 'INV' and year = extract(year from now())::int;
end;
$$;

-- ============================================================
-- 4. Re-number existing receipts: SIIF-RCPT-2026-00001 ...
-- ============================================================
do $$
declare
  r record;
  seq int := 0;
  new_number text;
  yr int;
begin
  for r in
    select id, created_at
    from public.fee_collections
    order by created_at asc
  loop
    seq := seq + 1;
    yr  := extract(year from r.created_at)::int;
    new_number := 'SIIF-RCPT-' || yr || '-' || lpad(seq::text, 5, '0');

    update public.fee_collections
    set receipt_number = new_number
    where id = r.id;
  end loop;

  -- Update counter
  update public.siif_counters
  set last_seq = seq
  where series = 'RCPT' and year = extract(year from now())::int;
end;
$$;

-- Also update receipt_number in payment_gateway_orders if the table exists
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name = 'payment_gateway_orders'
  ) then
    update public.payment_gateway_orders pgo
    set receipt_number = fc.receipt_number
    from public.fee_collections fc
    where fc.transaction_reference = pgo.gateway_payment_id
      and pgo.receipt_number is not null;
  end if;
end;
$$;

-- Verify invoices
select invoice_number, billing_month, status, created_at
from public.incubation_fee_invoices
where status != 'void'
order by created_at asc;

-- Verify receipts
select receipt_number, collection_date, created_at
from public.fee_collections
order by created_at asc;
