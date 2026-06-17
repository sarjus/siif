/**
 * Sequential number generation for invoices and receipts.
 * Uses an atomic Supabase counter (next_siif_number function) to ensure
 * no two records ever get the same number, even under concurrent requests.
 *
 * Formats:
 *   Invoice : SIIF-INV-2026-00001
 *   Receipt : SIIF-RCPT-2026-00001
 *
 * SERVER-SIDE ONLY — uses service role client.
 */

import { type SupabaseClient } from '@supabase/supabase-js';

const padSeq = (n: number) => String(n).padStart(5, '0');

/**
 * Atomically get the next invoice number for the given year.
 * Calls the Supabase `next_siif_number('INV', year)` function.
 */
export const nextInvoiceNumber = async (
  supabaseAdmin: SupabaseClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await supabaseAdmin.rpc('next_siif_number', {
    p_series: 'INV',
    p_year: yr,
  });
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);
  return `SIIF-INV-${yr}-${padSeq(data as number)}`;
};

/**
 * Atomically get the next receipt number for the given year.
 * Calls the Supabase `next_siif_number('RCPT', year)` function.
 */
export const nextReceiptNumber = async (
  supabaseAdmin: SupabaseClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await supabaseAdmin.rpc('next_siif_number', {
    p_series: 'RCPT',
    p_year: yr,
  });
  if (error) throw new Error(`Failed to generate receipt number: ${error.message}`);
  return `SIIF-RCPT-${yr}-${padSeq(data as number)}`;
};

/**
 * Atomically get the next payment number for the given year.
 * Used for outgoing payments (salary, honorarium) from SIIF.
 * Calls the Supabase `next_siif_number('PAY', year)` function.
 */
export const nextPaymentNumber = async (
  supabaseAdmin: SupabaseClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await supabaseAdmin.rpc('next_siif_number', {
    p_series: 'PAY',
    p_year: yr,
  });
  if (error) throw new Error(`Failed to generate payment number: ${error.message}`);
  return `SIIF-PAY-${yr}-${padSeq(data as number)}`;
};

/**
 * Generate the next incubatee ID: 26SIIF001 format
 * YY (2-digit year) + SIIF + 3-digit sequence
 */
export const nextIncubateeId = async (
  supabaseAdmin: SupabaseClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await supabaseAdmin.rpc('next_siif_number', {
    p_series: 'EMP',
    p_year: yr,
  });
  if (error) throw new Error(`Failed to generate incubatee ID: ${error.message}`);
  const yy = String(yr).slice(-2); // last 2 digits: 2026 → "26"
  const seq = String(data as number).padStart(3, '0');
  return `${yy}SIIF${seq}`;
};
