'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import AdminShell from '@/components/AdminShell';
import { formatCurrency } from '@/lib/fee-management';

// ── Tiny SVG chart helpers ──────────────────────────────────────────

function DonutChart({ data, colors, size = 160 }: {
  data: { label: string; value: number }[];
  colors: string[];
  size?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <div className="flex items-center justify-center h-40 text-sm text-[#8A8A8A]">No data</div>;
  const cx = size / 2, cy = size / 2, r = size * 0.38, ir = size * 0.22;
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const ix1 = cx + ir * Math.cos(angle);
    const iy1 = cy + ir * Math.sin(angle);
    const ix2 = cx + ir * Math.cos(angle + sweep);
    const iy2 = cy + ir * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M${ix1},${iy1} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large} 0 ${ix1},${iy1} Z`;
    const slice = { path, color: colors[i % colors.length], label: d.label, value: d.value };
    angle += sweep;
    return slice;
  });
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />)}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fontWeight="bold" fill="#172033">{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fontSize="8" fill="#8A8A8A">total</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[#667085]">{s.label}</span>
            <span className="font-bold text-[#172033] ml-auto pl-2">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function BarChart({ bars, color = '#FF3B3B', valueFormatter = (v: number) => String(v) }: {
  bars: { label: string; value: number }[];
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const max = Math.max(...bars.map((b) => b.value), 1);
  const h = 120;
  const w = 40;
  const gap = 10;
  const totalW = bars.length * (w + gap) - gap + 40;
  return (
    <div className="overflow-x-auto">
      <svg width={totalW} height={h + 50} viewBox={`0 0 ${totalW} ${h + 50}`}>
        {bars.map((bar, i) => {
          const barH = Math.max((bar.value / max) * h, bar.value > 0 ? 4 : 0);
          const x = 20 + i * (w + gap);
          const y = h - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={barH} fill={color} rx="3" opacity="0.85" />
              {bar.value > 0 && (
                <text x={x + w / 2} y={y - 4} textAnchor="middle" fontSize="8" fill="#344054" fontWeight="600">
                  {valueFormatter(bar.value)}
                </text>
              )}
              <text x={x + w / 2} y={h + 14} textAnchor="middle" fontSize="8" fill="#8A8A8A">
                {bar.label}
              </text>
            </g>
          );
        })}
        {/* baseline */}
        <line x1="16" y1={h} x2={totalW - 4} y2={h} stroke="#E3E7EE" strokeWidth="1" />
      </svg>
    </div>
  );
}

function HorizontalBarChart({ bars, colors }: {
  bars: { label: string; paid: number; outstanding: number }[];
  colors: { paid: string; outstanding: string };
}) {
  const max = Math.max(...bars.flatMap((b) => [b.paid + b.outstanding]), 1);
  return (
    <div className="space-y-3">
      {bars.map((bar, i) => {
        const paidW = (bar.paid / max) * 100;
        const outW = (bar.outstanding / max) * 100;
        return (
          <div key={i}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="font-semibold text-[#344054] truncate max-w-[120px]" title={bar.label}>{bar.label}</span>
              <span className="text-[#8A8A8A]">
                {formatCurrency(bar.paid)} paid · {formatCurrency(bar.outstanding)} due
              </span>
            </div>
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-[#F3F4F6]">
              {bar.paid > 0 && (
                <div className="h-full transition-all" style={{ width: `${paidW}%`, backgroundColor: colors.paid }} title={`Paid: ${formatCurrency(bar.paid)}`} />
              )}
              {bar.outstanding > 0 && (
                <div className="h-full transition-all" style={{ width: `${outW}%`, backgroundColor: colors.outstanding }} title={`Outstanding: ${formatCurrency(bar.outstanding)}`} />
              )}
            </div>
          </div>
        );
      })}
      <div className="flex gap-4 mt-2 text-xs">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.paid }} />Paid</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: colors.outstanding }} />Outstanding</span>
      </div>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────

type Charts = {
  invoiceStatus: Record<string, number>;
  monthlyCollections: Record<string, number>;
  companyBreakdown: { label: string; paid: number; outstanding: number }[];
  collectionTypes: Record<string, number>;
};

export default function FeeManagementOverviewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState({
    totalMonthlyCollection: 0, totalDepositsCollected: 0,
    pendingFees: 0, pendingDeposits: 0, overdueFees: 0,
    recentPayments: 0, upcomingDuePayments: 0,
  });
  const [charts, setCharts] = useState<Charts | null>(null);

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      const res = await fetch('/api/admin/fee-management/overview', { headers: await getAuthHeaders() });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to load overview');

      setStats(payload.stats);
      setCharts(payload.charts || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fee management overview');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const handleRunMonthlyCycle = async () => {
    setRunningCycle(true); setError(null); setNotice(null);
    try {
      const res = await fetch('/api/admin/fee-management/run-monthly-cycle', {
        method: 'POST', headers: await getAuthHeaders(),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error || 'Failed to run monthly cycle');
      setNotice(`Monthly cycle completed. Invoices created: ${payload.created}, notifications: ${payload.notificationsCreated}, emails sent: ${payload.emailsSent}.`);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run monthly cycle');
    } finally {
      setRunningCycle(false);
    }
  };

  // Prepare chart data
  const invoiceDonutData = charts ? [
    { label: 'Paid', value: charts.invoiceStatus.paid || 0 },
    { label: 'Pending', value: charts.invoiceStatus.pending || 0 },
    { label: 'Partial', value: charts.invoiceStatus.partially_paid || 0 },
    { label: 'Overdue', value: charts.invoiceStatus.overdue || 0 },
  ].filter((d) => d.value > 0) : [];

  const monthlyBarData = charts
    ? Object.entries(charts.monthlyCollections).map(([key, value]) => {
        const [year, month] = key.split('-');
        const label = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
        return { label, value };
      })
    : [];

  const collectionTypeData = charts
    ? Object.entries(charts.collectionTypes).map(([key, value]) => ({
        label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        value,
      }))
    : [];

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell
      title="Fee Management"
      subtitle="Overview of collections, dues, deposits, and upcoming payments"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        <button onClick={handleRunMonthlyCycle} disabled={runningCycle}
          className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
          {runningCycle ? 'Running...' : 'Run Monthly Cycle Now'}
        </button>
      }
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-4 mb-6">
        {[
          ['Total Monthly Collection', formatCurrency(stats.totalMonthlyCollection), '#FF3B3B'],
          ['Total Deposits Collected', formatCurrency(stats.totalDepositsCollected), '#16A34A'],
          ['Pending Fees', String(stats.pendingFees), '#F59E0B'],
          ['Overdue Fees', String(stats.overdueFees), '#DC2626'],
          ['Pending Deposits', String(stats.pendingDeposits), '#2AA0D3'],
          ['Recent Payments', String(stats.recentPayments), '#7C3AED'],
          ['Upcoming Due', String(stats.upcomingDuePayments), '#0EA5A0'],
        ].map(([label, value, color]) => (
          <Card key={String(label)} className="border-0 shadow p-4">
            <p className="text-[11px] font-bold uppercase text-[#8A8A8A] mb-1">{label}</p>
            <p className="text-2xl font-bold" style={{ color: String(color) }}>{value}</p>
          </Card>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Invoice status donut */}
        <Card className="border-0 shadow p-6">
          <h3 className="mb-4 text-sm font-bold uppercase text-[#8A8A8A]">Invoice Status Distribution</h3>
          <DonutChart
            data={invoiceDonutData}
            colors={['#16A34A', '#F59E0B', '#2AA0D3', '#DC2626']}
          />
        </Card>

        {/* Monthly collections bar */}
        <Card className="border-0 shadow p-6">
          <h3 className="mb-4 text-sm font-bold uppercase text-[#8A8A8A]">Monthly Collections (Last 6 Months)</h3>
          {monthlyBarData.every((b) => b.value === 0) ? (
            <div className="flex h-40 items-center justify-center text-sm text-[#8A8A8A]">No collection data yet</div>
          ) : (
            <BarChart
              bars={monthlyBarData}
              color="#FF3B3B"
              valueFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
            />
          )}
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Per-company paid vs outstanding */}
        <Card className="border-0 shadow p-6">
          <h3 className="mb-4 text-sm font-bold uppercase text-[#8A8A8A]">Per Company — Paid vs Outstanding</h3>
          {charts?.companyBreakdown && charts.companyBreakdown.length > 0 ? (
            <HorizontalBarChart
              bars={charts.companyBreakdown}
              colors={{ paid: '#16A34A', outstanding: '#F59E0B' }}
            />
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-[#8A8A8A]">No data yet</div>
          )}
        </Card>

        {/* Collection type breakdown bar */}
        <Card className="border-0 shadow p-6">
          <h3 className="mb-4 text-sm font-bold uppercase text-[#8A8A8A]">Collection Type Breakdown</h3>
          {collectionTypeData.length === 0 ? (
            <div className="flex h-24 items-center justify-center text-sm text-[#8A8A8A]">No data yet</div>
          ) : (
            <DonutChart
              data={collectionTypeData}
              colors={['#FF3B3B', '#2AA0D3', '#F59E0B', '#16A34A', '#7C3AED', '#0EA5A0']}
              size={140}
            />
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
