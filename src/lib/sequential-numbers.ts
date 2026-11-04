/**
 * Sequential number generation for invoices and receipts.
 * Uses an atomic MySQL counter (next_siif_number function) to ensure
 * no two records ever get the same number, even under concurrent requests.
 *
 * Formats:
 *   Invoice : SIIF-INV-2026-00001
 *   Receipt : SIIF-RCPT-2026-00001
 *
 * SERVER-SIDE ONLY — uses service role client.
 */

import type { MysqlFromClient, MysqlRpcClient } from '@/lib/mysql';

const padSeq = (n: number) => String(n).padStart(5, '0');

/**
 * Next invoice number = largest sequence among active (non-void) invoices for the year + 1.
 * Voided invoices are ignored; any void row holding the number about to be issued
 * is renamed so the unique invoice_number constraint is not violated.
 * `pending` holds numbers generated in the same batch but not yet saved.
 */
export const nextInvoiceNumber = async (
  databaseAdmin: MysqlFromClient,
  year?: number,
  pending: string[] = []
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const prefix = `SIIF-INV-${yr}-`;
  const { data, error } = await databaseAdmin
    .from('incubation_fee_invoices')
    .select('id, invoice_number, status')
    .like('invoice_number', `${prefix}%`);
  if (error) throw new Error(`Failed to generate invoice number: ${error.message}`);

  const parseSeq = (num?: string | null) => {
    const match = num?.startsWith(prefix) ? /^(\d+)$/.exec(num.slice(prefix.length)) : null;
    return match ? parseInt(match[1], 10) : 0;
  };

  const rows = (data || []) as Array<{ id: string; invoice_number: string; status: string }>;
  let max = 0;
  for (const row of rows) {
    if (row.status !== 'void') max = Math.max(max, parseSeq(row.invoice_number));
  }
  for (const num of pending) max = Math.max(max, parseSeq(num));

  const nextNumber = `${prefix}${padSeq(max + 1)}`;

  const blockers = rows.filter((r) => r.status === 'void' && r.invoice_number === nextNumber);
  for (const row of blockers) {
    const { error: renameError } = await databaseAdmin
      .from('incubation_fee_invoices')
      .update({ invoice_number: `${row.invoice_number}-VOID-${row.id}`.slice(0, 80) })
      .eq('id', row.id);
    if (renameError) throw new Error(`Failed to generate invoice number: ${renameError.message}`);
  }

  return nextNumber;
};

/**
 * Atomically get the next receipt number for the given year.
 * Calls the MySQL `next_siif_number('RCPT', year)` function.
 */
export const nextReceiptNumber = async (
  databaseAdmin: MysqlRpcClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await databaseAdmin.rpc('next_siif_number', {
    p_series: 'RCPT',
    p_year: yr,
  });
  if (error) throw new Error(`Failed to generate receipt number: ${error.message}`);
  return `SIIF-RCPT-${yr}-${padSeq(data as number)}`;
};

/**
 * Atomically get the next payment number for the given year.
 * Used for outgoing payments (salary, honorarium) from SIIF.
 * Calls the MySQL `next_siif_number('PAY', year)` function.
 */
export const nextPaymentNumber = async (
  databaseAdmin: MysqlRpcClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await databaseAdmin.rpc('next_siif_number', {
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
  databaseAdmin: MysqlRpcClient,
  year?: number
): Promise<string> => {
  const yr = year ?? new Date().getFullYear();
  const { data, error } = await databaseAdmin.rpc('next_siif_number', {
    p_series: 'EMP',
    p_year: yr,
  });
  if (error) throw new Error(`Failed to generate incubatee ID: ${error.message}`);
  const yy = String(yr).slice(-2); // last 2 digits: 2026 → "26"
  const seq = String(data as number).padStart(3, '0');
  return `${yy}SIIF${seq}`;
};
