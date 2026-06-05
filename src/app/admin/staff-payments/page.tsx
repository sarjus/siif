'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/fee-management';
import { downloadPaymentSlipPdf, type PaymentSlipDetails } from '@/lib/staff-payment-pdf';
import { loadLogoForPdf } from '@/lib/pdf-logo';

type Staff = {
  id: string;
  name: string;
  designation: string;
  payment_type: 'salary' | 'honorarium';
  amount: number;
  bank_account: string | null;
  ifsc: string | null;
  email: string | null;
  is_active: boolean;
  notes: string | null;
};

type StaffPayment = {
  id: string;
  payment_number: string;
  staff_id: string;
  payment_type: string;
  payment_month: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  transaction_reference: string | null;
  paid_by: string | null;
  remarks: string | null;
  siif_staff?: { name: string; designation: string; payment_type: string } | null;
};

const PAYMENT_MODES = ['bank_transfer', 'cash', 'upi', 'cheque', 'other'];

const emptyStaffForm = {
  id: '',
  name: '',
  designation: '',
  paymentType: 'honorarium' as 'salary' | 'honorarium',
  amount: '',
  bankAccount: '',
  ifsc: '',
  email: '',
  isActive: true,
  notes: '',
};

const emptyPayForm = {
  staffId: '',
  paymentType: 'honorarium' as 'salary' | 'honorarium',
  paymentMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`,
  amount: '',
  paymentMode: 'bank_transfer',
  paymentDate: new Date().toISOString().slice(0, 10),
  transactionReference: '',
  remarks: '',
};

export default function StaffPaymentsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [activeTab, setActiveTab] = useState<'payments' | 'staff'>('payments');
  const [showPayForm, setShowPayForm] = useState(false);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payForm, setPayForm] = useState(emptyPayForm);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [latestSlip, setLatestSlip] = useState<PaymentSlipDetails | null>(null);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      const headers = await getAuthHeaders();
      const [staffRes, paymentsRes] = await Promise.all([
        fetch('/api/admin/staff', { headers }),
        fetch('/api/admin/staff/payments', { headers }),
      ]);

      const staffPayload = await staffRes.json();
      const paymentsPayload = await paymentsRes.json();

      if (!staffRes.ok) throw new Error(staffPayload.error || 'Failed to load staff');
      if (!paymentsRes.ok) throw new Error(paymentsPayload.error || 'Failed to load payments');

      setStaff(staffPayload.staff || []);
      setPayments(paymentsPayload.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-fill amount and payment type when staff is selected
  const handleStaffSelect = (staffId: string) => {
    const selected = staff.find((s) => s.id === staffId);
    setPayForm((prev) => ({
      ...prev,
      staffId,
      paymentType: selected?.payment_type || 'honorarium',
      amount: selected?.amount ? String(selected.amount) : '',
    }));
  };

  const handleRecordPayment = async () => {
    if (!payForm.staffId || !payForm.amount || !payForm.paymentDate) {
      setError('Staff, amount, and payment date are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/staff/payments', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: payForm.staffId,
          paymentType: payForm.paymentType,
          paymentMonth: payForm.paymentMonth,
          amount: Number(payForm.amount),
          paymentMode: payForm.paymentMode,
          paymentDate: payForm.paymentDate,
          transactionReference: payForm.transactionReference || null,
          remarks: payForm.remarks || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to record payment');

      setLatestSlip(payload.slip);
      setNotice(`Payment ${payload.payment.payment_number} recorded successfully.`);
      setPayForm(emptyPayForm);
      setShowPayForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStaff = async () => {
    if (!staffForm.name || !staffForm.designation) {
      setError('Name and designation are required.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: staffForm.id || undefined,
          name: staffForm.name,
          designation: staffForm.designation,
          paymentType: staffForm.paymentType,
          amount: Number(staffForm.amount || 0),
          bankAccount: staffForm.bankAccount || null,
          ifsc: staffForm.ifsc || null,
          email: staffForm.email || null,
          isActive: staffForm.isActive,
          notes: staffForm.notes || null,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to save staff');

      setNotice(`Staff ${staffForm.id ? 'updated' : 'added'} successfully.`);
      setStaffForm(emptyStaffForm);
      setShowStaffForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save staff');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadSlip = async (slip: PaymentSlipDetails) => {
    const logoDataUrl = await loadLogoForPdf();
    downloadPaymentSlipPdf({ ...slip, logoDataUrl });
  };

  const monthLabel = (paymentMonth: string) => {
    const [year, month] = paymentMonth.slice(0, 7).split('-').map(Number);
    return new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  };

  const filteredPayments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return payments;
    return payments.filter((p) =>
      p.payment_number.toLowerCase().includes(q) ||
      (p.siif_staff?.name || '').toLowerCase().includes(q) ||
      (p.siif_staff?.designation || '').toLowerCase().includes(q) ||
      p.payment_type.toLowerCase().includes(q)
    );
  }, [payments, search]);

  const totalPaid = useMemo(() =>
    payments.reduce((sum, p) => sum + Number(p.amount || 0), 0), [payments]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell
      title="Staff Payments"
      subtitle="Manage salary and honorarium payments to SIIF staff and CEO"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        <div className="flex gap-2">
          <button
            onClick={() => { setShowStaffForm(true); setStaffForm(emptyStaffForm); setError(null); }}
            className="rounded-lg border border-[#E3E7EE] bg-white px-4 py-2 text-sm font-semibold text-[#344054] hover:bg-[#F8FAFC]"
          >
            + Add Staff
          </button>
          <button
            onClick={() => { setShowPayForm(true); setPayForm(emptyPayForm); setError(null); }}
            className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            + Record Payment
          </button>
        </div>
      }
    >
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      {/* Summary card */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow p-5">
          <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Total Paid (All Time)</p>
          <p className="text-2xl font-bold text-[#FF3B3B]">{formatCurrency(totalPaid)}</p>
        </Card>
        <Card className="border-0 shadow p-5">
          <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Total Payments</p>
          <p className="text-2xl font-bold text-[#344054]">{payments.length}</p>
        </Card>
        <Card className="border-0 shadow p-5">
          <p className="mb-1 text-xs font-bold uppercase text-[#8A8A8A]">Active Staff</p>
          <p className="text-2xl font-bold text-[#344054]">{staff.filter((s) => s.is_active).length}</p>
        </Card>
      </div>

      {/* Latest slip download */}
      {latestSlip && (
        <Card className="mb-6 border-0 shadow p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#344054]">{latestSlip.paymentNumber} — {latestSlip.staffName}</p>
            <p className="text-xs text-[#8A8A8A]">{formatCurrency(latestSlip.amount)} · {monthLabel(latestSlip.paymentMonth)}</p>
          </div>
          <button
            onClick={() => handleDownloadSlip(latestSlip)}
            className="rounded-lg bg-[#2AA0D3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2289b5]"
          >
            Download Payment Slip
          </button>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-[#E3E7EE]">
        {(['payments', 'staff'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold capitalize border-b-2 transition-colors ${
              activeTab === tab ? 'border-[#FF3B3B] text-[#FF3B3B]' : 'border-transparent text-[#667085] hover:text-[#344054]'
            }`}
          >
            {tab === 'payments' ? 'Payment History' : 'Staff Members'}
          </button>
        ))}
      </div>

      {/* Payment History Tab */}
      {activeTab === 'payments' && (
        <>
          <Card className="mb-4 border-0 shadow p-4">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search payment number, staff name, or type..."
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
            />
          </Card>
          <Card className="border-0 shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F5F6F7' }}>
                    {['Payment No.', 'Staff', 'Type', 'Month', 'Amount', 'Mode', 'Date', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No payments recorded yet.</td></tr>
                  ) : filteredPayments.map((p) => (
                    <tr key={p.id} className="border-t border-gray-200">
                      <td className="px-4 py-3 text-sm font-semibold text-[#4A4A4A]">{p.payment_number}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">
                        <div className="font-semibold">{p.siif_staff?.name || '-'}</div>
                        <div className="text-xs text-[#8A8A8A]">{p.siif_staff?.designation || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize text-[#4A4A4A]">{p.payment_type}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">{monthLabel(p.payment_month)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-[#4A4A4A]">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A] capitalize">{p.payment_mode.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3 text-sm text-[#4A4A4A]">{p.payment_date}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => {
                            const slip: PaymentSlipDetails = {
                              paymentNumber: p.payment_number,
                              paymentDate: p.payment_date,
                              paymentMonth: p.payment_month,
                              staffName: p.siif_staff?.name || '',
                              designation: p.siif_staff?.designation || '',
                              paymentType: p.payment_type as 'salary' | 'honorarium',
                              amount: p.amount,
                              paymentMode: p.payment_mode,
                              transactionReference: p.transaction_reference,
                              paidBy: p.paid_by,
                              remarks: p.remarks,
                            };
                            handleDownloadSlip(slip);
                          }}
                          className="rounded-lg bg-[#2AA0D3] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2289b5]"
                        >
                          Slip
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Staff Members Tab */}
      {activeTab === 'staff' && (
        <Card className="border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Name', 'Designation', 'Type', 'Default Amount', 'Bank Account', 'Status', 'Action'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staff.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No staff added yet.</td></tr>
                ) : staff.map((s) => (
                  <tr key={s.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-semibold text-[#4A4A4A]">{s.name}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{s.designation}</td>
                    <td className="px-4 py-3 text-sm capitalize text-[#4A4A4A]">{s.payment_type}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{s.amount > 0 ? formatCurrency(s.amount) : '—'}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{s.bank_account || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${s.is_active ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          setStaffForm({
                            id: s.id, name: s.name, designation: s.designation,
                            paymentType: s.payment_type, amount: String(s.amount),
                            bankAccount: s.bank_account || '', ifsc: s.ifsc || '',
                            email: s.email || '', isActive: s.is_active, notes: s.notes || '',
                          });
                          setShowStaffForm(true);
                        }}
                        className="rounded-lg bg-[#FF3B3B] px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Record Payment Modal */}
      {showPayForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg border-0 shadow-2xl p-6 bg-white max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Record Payment</h3>
              <button onClick={() => setShowPayForm(false)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Staff Member</label>
                <select
                  value={payForm.staffId}
                  onChange={(e) => handleStaffSelect(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  <option value="">Select staff</option>
                  {staff.filter((s) => s.is_active).map((s) => (
                    <option key={s.id} value={s.id}>{s.name} — {s.designation}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Type</label>
                <select
                  value={payForm.paymentType}
                  onChange={(e) => setPayForm((p) => ({ ...p, paymentType: e.target.value as 'salary' | 'honorarium' }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  <option value="salary">Salary</option>
                  <option value="honorarium">Honorarium</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Month</label>
                <input
                  type="month"
                  value={payForm.paymentMonth.slice(0, 7)}
                  onChange={(e) => setPayForm((p) => ({ ...p, paymentMonth: `${e.target.value}-01` }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount (₹)</label>
                <input
                  type="number"
                  value={payForm.amount}
                  onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="Enter amount"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Mode</label>
                <select
                  value={payForm.paymentMode}
                  onChange={(e) => setPayForm((p) => ({ ...p, paymentMode: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>{m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Date</label>
                <input
                  type="date"
                  value={payForm.paymentDate}
                  onChange={(e) => setPayForm((p) => ({ ...p, paymentDate: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Transaction Reference</label>
                <input
                  value={payForm.transactionReference}
                  onChange={(e) => setPayForm((p) => ({ ...p, transactionReference: e.target.value }))}
                  placeholder="e.g. UTR / cheque number"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Remarks</label>
                <textarea
                  value={payForm.remarks}
                  onChange={(e) => setPayForm((p) => ({ ...p, remarks: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleRecordPayment}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Record & Generate Slip'}
              </button>
              <button
                onClick={() => setShowPayForm(false)}
                className="rounded-lg border border-[#E3E7EE] px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Add/Edit Staff Modal */}
      {showStaffForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg border-0 shadow-2xl p-6 bg-white max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">{staffForm.id ? 'Edit Staff' : 'Add Staff'}</h3>
              <button onClick={() => setShowStaffForm(false)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{error}</div>}
            <div className="space-y-4">
              {[
                ['Name', 'name', 'text', 'e.g. John Thomas'],
                ['Designation', 'designation', 'text', 'e.g. CEO / Project Manager'],
                ['Email', 'email', 'email', 'Optional'],
                ['Bank Account', 'bankAccount', 'text', 'Optional'],
                ['IFSC Code', 'ifsc', 'text', 'Optional'],
              ].map(([label, key, type, placeholder]) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium">{label}</label>
                  <input
                    type={type}
                    value={staffForm[key as keyof typeof staffForm] as string}
                    onChange={(e) => setStaffForm((p) => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-sm font-medium">Payment Type</label>
                <select
                  value={staffForm.paymentType}
                  onChange={(e) => setStaffForm((p) => ({ ...p, paymentType: e.target.value as 'salary' | 'honorarium' }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                >
                  <option value="honorarium">Honorarium</option>
                  <option value="salary">Salary</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Default Amount (₹) <span className="text-[#8A8A8A] font-normal">— can override per payment</span></label>
                <input
                  type="number"
                  value={staffForm.amount}
                  onChange={(e) => setStaffForm((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={staffForm.isActive}
                  onChange={(e) => setStaffForm((p) => ({ ...p, isActive: e.target.checked }))}
                  className="h-4 w-4 accent-[#FF3B3B]"
                />
                <label htmlFor="isActive" className="text-sm font-medium">Active</label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea
                  value={staffForm.notes}
                  onChange={(e) => setStaffForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                onClick={handleSaveStaff}
                disabled={saving}
                className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : staffForm.id ? 'Update Staff' : 'Add Staff'}
              </button>
              <button
                onClick={() => setShowStaffForm(false)}
                className="rounded-lg border border-[#E3E7EE] px-4 py-2.5 text-sm font-semibold text-[#344054] hover:bg-[#F8FAFC]"
              >
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
