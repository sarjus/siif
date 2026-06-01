'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { Card } from '@/components/ui/card';
import AdminShell from '@/components/AdminShell';
import { FeeSettingRecord, DepositRecord, formatCurrency } from '@/lib/fee-management';

type Company = {
  id: string;
  business_name: string | null;
  lead_name: string | null;
  email: string;
  status: string;
};

const emptyForm = {
  companyId: '',
  hasDeposit: false,
  monthlyFee: '0',
  refundableDeposit: '0',
  depositCollectionDate: '',
  depositStatus: 'pending',
  startDate: '',
  dueDay: '5',
  gracePeriodDays: '0',
  status: 'active',
};

export default function FeeConfigurationPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [settings, setSettings] = useState<FeeSettingRecord[]>([]);
  const [deposits, setDeposits] = useState<DepositRecord[]>([]);
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/configuration', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load fee configuration data');
      }

      setCompanies((payload.companies || []) as Company[]);
      setSettings((payload.settings || []) as FeeSettingRecord[]);
      setDeposits((payload.deposits || []) as DepositRecord[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fee configuration data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const companySettings = useMemo(
    () => Object.fromEntries(settings.map((setting) => [setting.company_id, setting])),
    [settings]
  );

  const companyDeposits = useMemo(
    () => Object.fromEntries(deposits.map((deposit) => [deposit.company_id, deposit])),
    [deposits]
  );

  const handleCompanyChange = (companyId: string) => {
    const setting = companySettings[companyId];
    const deposit = companyDeposits[companyId];

    setForm({
      companyId,
      hasDeposit: Number(setting?.refundable_deposit ?? deposit?.deposit_amount ?? 0) > 0,
      monthlyFee: String(setting?.monthly_fee ?? 0),
      refundableDeposit: String(setting?.refundable_deposit ?? deposit?.deposit_amount ?? 0),
      depositCollectionDate: setting?.deposit_collection_date || deposit?.collection_date || '',
      depositStatus: setting?.deposit_status || deposit?.status || 'pending',
      startDate: setting?.start_date || '',
      dueDay: String(setting?.due_day ?? 5),
      gracePeriodDays: String(setting?.grace_period_days ?? 0),
      status: setting?.status || 'active',
    });
  };

  const handleSave = async () => {
    if (!form.companyId || !form.startDate) {
      setError('Select a company and provide a fee start date.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/fee-management/configuration', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: form.companyId,
          monthlyFee: Number(form.monthlyFee || 0),
          refundableDeposit: Number(form.refundableDeposit || 0),
          depositCollectionDate: form.depositCollectionDate || null,
          depositStatus: form.depositStatus,
          startDate: form.startDate,
          dueDay: Number(form.dueDay || 5),
          gracePeriodDays: Number(form.gracePeriodDays || 0),
          status: form.status,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to save fee configuration');
      }

      setNotice('Fee configuration saved successfully.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save fee configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <AdminShell
      title="Fee Configuration"
      subtitle="Configure monthly fee plans and refundable deposit rules for incubated companies"
      userEmail={userEmail}
      onLogout={handleLogout}
    >
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1 border-0 shadow p-6">
          <h3 className="text-lg font-bold mb-4" style={{ color: '#FF3B3B' }}>Plan Setup</h3>
          <div className="space-y-4">
            <div>
              <label className="block mb-1 text-sm font-medium">Company</label>
              <select
                value={form.companyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2"
              >
                <option value="">Select approved company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.business_name || company.email}
                  </option>
                ))}
              </select>
            </div>
            {[
              ['Monthly Fee', 'monthlyFee', 'number'],
              ['Fee Start Date', 'startDate', 'date'],
              ['Due Day', 'dueDay', 'number'],
              ['Grace Period (Days)', 'gracePeriodDays', 'number'],
            ].map(([label, key, type]) => (
              <div key={key}>
                <label className="block mb-1 text-sm font-medium">{label}</label>
                <input
                  type={type}
                  value={form[key as keyof typeof form] as string}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2"
                />
              </div>
            ))}

            {/* Refundable deposit toggle */}
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3">
              <input
                id="hasDeposit"
                type="checkbox"
                checked={!!form.hasDeposit}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    hasDeposit: e.target.checked,
                    ...(e.target.checked ? {} : {
                      refundableDeposit: '0',
                      depositCollectionDate: '',
                      depositStatus: 'pending',
                    }),
                  }))
                }
                className="h-4 w-4 accent-[#FF3B3B] cursor-pointer"
              />
              <label htmlFor="hasDeposit" className="text-sm font-medium cursor-pointer select-none">
                Has Refundable Security Deposit
              </label>
            </div>

            {form.hasDeposit && (
              <>
                <div>
                  <label className="block mb-1 text-sm font-medium">Refundable Deposit Amount</label>
                  <input
                    type="number"
                    value={form.refundableDeposit}
                    onChange={(e) => setForm((prev) => ({ ...prev, refundableDeposit: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Deposit Collection Date</label>
                  <input
                    type="date"
                    value={form.depositCollectionDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, depositCollectionDate: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2"
                  />
                </div>
                <div>
                  <label className="block mb-1 text-sm font-medium">Deposit Status</label>
                  <select value={form.depositStatus} onChange={(e) => setForm((prev) => ({ ...prev, depositStatus: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                    <option value="pending">Pending</option>
                    <option value="collected">Collected</option>
                    <option value="partially_refunded">Partially Refunded</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </>
            )}
            <div>
              <label className="block mb-1 text-sm font-medium">Plan Status</label>
              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full rounded-lg border border-gray-300 px-4 py-2">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <button onClick={handleSave} disabled={saving} className="w-full rounded-lg bg-[#FF3B3B] px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {saving ? 'Saving...' : form.companyId && companySettings[form.companyId] ? 'Update Configuration' : 'Save Configuration'}
            </button>
          </div>
        </Card>

        <Card className="xl:col-span-2 border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Company', 'Monthly Fee', 'Deposit', 'Start Date', 'Due Day', 'Plan Status', 'Deposit Status', ''].map((heading) => (
                    <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companies.map((company) => {
                  const setting = companySettings[company.id];
                  const deposit = companyDeposits[company.id];
                  return (
                    <tr key={company.id} className="border-t border-gray-200">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#4A4A4A]">{company.business_name || 'Company'}</div>
                        <div className="text-sm text-[#8A8A8A]">{company.email}</div>
                      </td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(setting?.monthly_fee || 0)}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{formatCurrency(setting?.refundable_deposit || deposit?.deposit_amount || 0)}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{setting?.start_date || '-'}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{setting?.due_day || '-'}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{setting?.status || 'Not Configured'}</td>
                      <td className="px-4 py-4 text-sm text-[#4A4A4A]">{setting?.deposit_status || deposit?.status || '-'}</td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => handleCompanyChange(company.id)}
                          className="rounded px-3 py-1 text-xs font-semibold text-white"
                          style={{ backgroundColor: '#FF3B3B' }}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
