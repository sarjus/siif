'use client';

import { FeedbackIcon } from '@/components/icons/feedback';
import { BarChart3, Landmark } from '@/components/icons/glyphs';

import { ActionIcon, ModuleIcon } from '@/components/icons/icon';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { database, getSafeSession, getAuthHeaders } from '@/lib/database';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { downloadReportPdf, exportCsv, formatCurrency, type CollectionRecord } from '@/lib/fee-management';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Row = Pick<CollectionRecord, 'company_id' | 'collection_type' | 'collection_date' | 'amount_collected' | 'payment_mode'> & {
  applications: { business_name: string | null } | null;
};

type CompanyTotal = { id: string; name: string; amount: number };

const chartSections = [
  { type: 'monthly_fee', title: 'Monthly Fee Collections', empty: 'No monthly fee collections to chart.', icon: BarChart3, palette: 'finance', barClass: 'bg-emerald-600' },
  { type: 'refundable_deposit', title: 'Refundable Deposit Collections', empty: 'No refundable deposit collections to chart.', icon: Landmark, palette: 'workspace', barClass: 'bg-blue-600' },
] as const;

function CompanyCollectionsChart({ companies, section, min, max }: {
  companies: CompanyTotal[];
  section: typeof chartSections[number];
  min: number;
  max: number;
}) {
  const headingId = `company-collections-${section.type}`;
  const subtotal = companies.reduce((sum, company) => sum + company.amount, 0);
  const scale = max - min || 1;
  const zero = (0 - min) / scale * 100;

  return (
    <Card className="min-w-0 gap-4 border-slate-200 p-5 shadow-sm sm:p-6">
      <figure aria-labelledby={headingId} className="space-y-5">
        <figcaption className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ModuleIcon icon={section.icon} palette={section.palette} />
            <h2 id={headingId} className="text-lg font-bold text-slate-900 dark:text-slate-100">{section.title}</h2>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Subtotal <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span></p>
        </figcaption>
        {companies.length === 0 ? (
          <p className="py-4 text-sm text-slate-600 dark:text-slate-300">{section.empty}</p>
        ) : (
          <>
            <ol role="list" className="space-y-4">
              {companies.map(({ id, name, amount }) => (
                <li key={id}>
                  <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                    <span className="min-w-0 break-words font-semibold text-slate-800 dark:text-slate-100">{name}</span>
                    <span className="shrink-0 font-bold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(amount)}</span>
                  </div>
                  <div aria-hidden="true" className="relative h-3.5 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                    <div className={`absolute inset-y-0 rounded ${amount < 0 ? 'bg-rose-600' : section.barClass}`}
                      style={{ left: `${(Math.min(0, amount) - min) / scale * 100}%`, width: `${Math.abs(amount) / scale * 100}%` }} />
                    {min < 0 && max > 0 && <span className="absolute inset-y-0 border-l border-slate-500" style={{ left: `${zero}%` }} />}
                  </div>
                </li>
              ))}
            </ol>
            <div aria-hidden="true" className="flex justify-between gap-3 border-t border-slate-200 pt-2 text-xs tabular-nums text-slate-600 dark:border-slate-700 dark:text-slate-300">
              <span>{formatCurrency(min)}</span>
              {max !== min && <span>{formatCurrency(max)}</span>}
            </div>
          </>
        )}
      </figure>
    </Card>
  );
}

export default function CollectionReportPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const session = await getSafeSession(); if (!session) { router.push('/login'); return; }
    setUserEmail(session.user.email || '');
    try {
      const res = await fetch('/api/admin/fee-management/reports', { headers: await getAuthHeaders() });
      const p = await res.json();
      if (!res.ok) throw new Error(p.error);
      setData(p.collections || []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => data.map((item) => [item.applications?.business_name || '-', item.collection_type.replace(/_/g, ' '), item.collection_date, formatCurrency(item.amount_collected), item.payment_mode.replace(/_/g, ' ')]), [data]);
  const total = useMemo(() => data.reduce((s, i) => s + Number(i.amount_collected || 0), 0), [data]);
  const charts = useMemo(() => chartSections.map((section) => {
    const groups = new Map<string, CompanyTotal>();
    for (const row of data) {
      if (row.collection_type !== section.type) continue;
      const name = row.applications?.business_name?.trim();
      const entry = groups.get(row.company_id) ?? { id: row.company_id, name: name || 'Unknown company', amount: 0 };
      if (name) entry.name = name;
      entry.amount += Number(row.amount_collected || 0);
      groups.set(row.company_id, entry);
    }
    const companies = [...groups.values()].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
    return { section, companies };
  }), [data]);
  const chartCompanies = charts.flatMap(({ companies }) => companies);
  const chartMin = chartCompanies.reduce((value, company) => Math.min(value, company.amount), 0);
  const chartMax = chartCompanies.reduce((value, company) => Math.max(value, company.amount), 0);

  const handleExportPdf = async () => { const logo = await loadLogoForPdf(); downloadReportPdf({ title: 'Collection Report', headers: ['Company', 'Type', 'Date', 'Amount', 'Mode'], rows, logoDataUrl: logo }); };
  const handleExportCsv = () => exportCsv('collection-report.csv', ['Company', 'Type', 'Date', 'Amount', 'Mode'], rows);
  const handleLogout = async () => { await database.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><FeedbackIcon kind="loading" />Loading...</div>;

  return (
    <AdminShell title="Collection Report" subtitle="All fee payments received" userEmail={userEmail} onLogout={handleLogout}
      headerActions={<div className="flex gap-2"><button onClick={handleExportCsv} className="rounded-lg border border-[#2AA0D3] px-4 py-2 text-sm font-semibold text-[#2AA0D3]"><ActionIcon name="export" />Export Excel</button><button onClick={handleExportPdf} className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white"><ActionIcon name="export" />Export PDF</button></div>}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]"><FeedbackIcon kind="error" />{error}</div>}
      <div className="mb-6"><Card className="border-0 shadow p-5 inline-block"><p className="text-xs font-bold uppercase text-[#8A8A8A]">Total Collected</p><p className="text-2xl font-bold text-[#16A34A]">{formatCurrency(total)}</p></Card></div>
      {!error && (
        <div className="mb-6 grid items-start gap-4 xl:grid-cols-2">
          {charts.map(({ section, companies }) => (
            <CompanyCollectionsChart key={section.type} section={section} companies={companies} min={chartMin} max={chartMax} />
          ))}
        </div>
      )}
      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full">
          <thead><tr style={{ backgroundColor: '#F5F6F7' }}>{['Company', 'Collection Type', 'Date', 'Amount', 'Payment Mode'].map((h) => <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}</tr></thead>
          <tbody>{rows.length === 0 ? <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No data.</td></tr> : rows.map((row, i) => <tr key={i} className="border-t border-gray-200">{row.map((cell, j) => <td key={j} className={`px-4 py-3 text-sm ${j === 3 ? 'font-semibold text-[#16A34A]' : 'text-[#4A4A4A]'}`}>{cell}</td>)}</tr>)}
          <tr className="border-t-2 border-[#172033] bg-[#F5F6F7]"><td colSpan={3} className="px-4 py-3 text-sm font-bold">TOTAL</td><td className="px-4 py-3 text-sm font-bold text-[#16A34A]">{formatCurrency(total)}</td><td /></tr>
          </tbody>
        </table></div>
      </Card>
    </AdminShell>
  );
}
