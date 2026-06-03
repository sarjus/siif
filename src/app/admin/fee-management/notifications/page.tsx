'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';

type Company = { id: string; business_name: string | null; email: string; };

export default function FeeNotificationsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [recipientType, setRecipientType] = useState('all');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');

      const response = await fetch('/api/admin/fee-management/notifications', {
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to load notifications');

      setCompanies(payload.companies || []);
      setNotifications(payload.notifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const sendNotification = async () => {
    if (!title || !message) { setError('Enter both title and message.'); return; }
    if (recipientType === 'selected' && selectedCompanyIds.length === 0) { setError('Select at least one company.'); return; }

    setSending(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch('/api/admin/fee-management/notifications', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientType, selectedCompanyIds, title, message }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to send notification');

      setNotice(`Notification sent to ${payload.sent} compan${payload.sent === 1 ? 'y' : 'ies'}.`);
      setTitle('');
      setMessage('');
      setSelectedCompanyIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Notifications" subtitle="Send dashboard reminders and keep a history of communications" userEmail={userEmail} onLogout={handleLogout}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-6 rounded-lg bg-[#EAF9F0] p-4 text-sm text-[#1E7F46]">{notice}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="xl:col-span-1 border-0 shadow p-6">
          <h3 className="mb-4 text-lg font-bold" style={{ color: '#FF3B3B' }}>Send Notification</h3>
          <div className="space-y-4">
            <select value={recipientType} onChange={(e) => setRecipientType(e.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2">
              <option value="all">All incubated companies</option>
              <option value="selected">Selected company</option>
              <option value="overdue">Companies with overdue payments</option>
              <option value="pending_deposits">Companies with pending deposits</option>
            </select>
            {recipientType === 'selected' && (
              <div className="rounded-lg border border-gray-200 max-h-52 overflow-y-auto p-2 space-y-1">
                <div className="flex justify-between items-center mb-1 px-1">
                  <span className="text-xs font-semibold text-[#4A4A4A]">Select companies</span>
                  <button type="button" className="text-xs text-[#2AA0D3] hover:underline" onClick={() => setSelectedCompanyIds(selectedCompanyIds.length === companies.length ? [] : companies.map((c) => c.id))}>
                    {selectedCompanyIds.length === companies.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                {companies.map((company) => (
                  <label key={company.id} className="flex items-center gap-2 px-1 py-1 cursor-pointer rounded hover:bg-gray-50">
                    <input type="checkbox" className="accent-[#FF3B3B]" checked={selectedCompanyIds.includes(company.id)} onChange={(e) => setSelectedCompanyIds((prev) => e.target.checked ? [...prev, company.id] : prev.filter((id) => id !== company.id))} />
                    <span className="text-sm text-[#4A4A4A]">{company.business_name || company.email}</span>
                  </label>
                ))}
              </div>
            )}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Notification message" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            <button onClick={sendNotification} disabled={sending} className="w-full rounded-lg bg-[#FF3B3B] px-4 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              {sending ? 'Sending...' : 'Send Notification'}
            </button>
          </div>
        </Card>

        <Card className="xl:col-span-2 border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Sent At', 'Title', 'Recipient', 'Type', 'Sent By'].map((h) => <th key={h} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {notifications.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No notifications sent yet.</td></tr>
                ) : notifications.map((n) => (
                  <tr key={n.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{new Date(n.sent_at).toLocaleString()}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                      <div className="font-semibold">{n.title}</div>
                      <div className="text-xs text-[#8A8A8A]">{n.message}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{n.applications?.business_name || n.applications?.email || 'All Matching Companies'}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{n.recipient_type}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{n.sent_by || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
