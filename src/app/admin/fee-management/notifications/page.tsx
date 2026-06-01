'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession } from '@/lib/supabase';
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
  const [companyId, setCompanyId] = useState('');
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/login');
        return;
      }
      setUserEmail(session.user.email || '');
      const [{ data: appRows }, { data: notificationRows }] = await Promise.all([
        supabase.from('applications').select('id, business_name, email').eq('status', 'approved').order('business_name', { ascending: true }),
        supabase.from('notifications').select('*, applications(business_name, email)').order('sent_at', { ascending: false }).limit(100),
      ]);
      setCompanies((appRows || []) as Company[]);
      setNotifications(notificationRows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadData(); }, [loadData]);

  const sendNotification = async () => {
    if (!title || !message) {
      setError('Enter both title and message.');
      return;
    }

    setError(null);
    setNotice(null);

    try {
      let targetCompanies = companies;
      if (recipientType === 'selected') {
        if (selectedCompanyIds.length === 0) {
          setError('Select at least one company.');
          return;
        }
        targetCompanies = companies.filter((company) => selectedCompanyIds.includes(company.id));
      } else if (recipientType === 'overdue') {
        const { data: overdueInvoices } = await supabase.from('incubation_fee_invoices').select('company_id').eq('status', 'overdue');
        const overdueIds = new Set((overdueInvoices || []).map((item) => item.company_id));
        targetCompanies = companies.filter((company) => overdueIds.has(company.id));
      } else if (recipientType === 'pending_deposits') {
        const { data: pendingDeposits } = await supabase.from('company_deposits').select('company_id').eq('status', 'pending');
        const pendingIds = new Set((pendingDeposits || []).map((item) => item.company_id));
        targetCompanies = companies.filter((company) => pendingIds.has(company.id));
      }

      const rows = targetCompanies.map((company) => ({
        title,
        message,
        recipient_type: recipientType,
        company_id: company.id,
        sent_by: userEmail,
      }));

      if (rows.length === 0) throw new Error('No matching companies found for this notification.');

      const { error: insertError } = await supabase.from('notifications').insert(rows);
      if (insertError) throw insertError;

      setNotice(`Notification sent to ${rows.length} compan${rows.length === 1 ? 'y' : 'ies'}.`);
      setTitle('');
      setMessage('');
      setSelectedCompanyIds([]);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

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
                  <button
                    type="button"
                    className="text-xs text-[#2AA0D3] hover:underline"
                    onClick={() =>
                      setSelectedCompanyIds(
                        selectedCompanyIds.length === companies.length
                          ? []
                          : companies.map((c) => c.id)
                      )
                    }
                  >
                    {selectedCompanyIds.length === companies.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                {companies.map((company) => (
                  <label key={company.id} className="flex items-center gap-2 px-1 py-1 cursor-pointer rounded hover:bg-gray-50">
                    <input
                      type="checkbox"
                      className="accent-[#FF3B3B]"
                      checked={selectedCompanyIds.includes(company.id)}
                      onChange={(e) =>
                        setSelectedCompanyIds((prev) =>
                          e.target.checked
                            ? [...prev, company.id]
                            : prev.filter((id) => id !== company.id)
                        )
                      }
                    />
                    <span className="text-sm text-[#4A4A4A]">{company.business_name || company.email}</span>
                  </label>
                ))}
              </div>
            )}
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Notification title" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Notification message" className="w-full rounded-lg border border-gray-300 px-4 py-2" />
            <button onClick={sendNotification} className="w-full rounded-lg bg-[#FF3B3B] px-4 py-3 font-semibold text-white hover:bg-red-700">Send Notification</button>
          </div>
        </Card>

        <Card className="xl:col-span-2 border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Sent At', 'Title', 'Recipient', 'Type', 'Sent By'].map((heading) => <th key={heading} className="px-4 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{heading}</th>)}
                </tr>
              </thead>
              <tbody>
                {notifications.map((notification) => (
                  <tr key={notification.id} className="border-t border-gray-200">
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{new Date(notification.sent_at).toLocaleString()}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">
                      <div className="font-semibold">{notification.title}</div>
                      <div className="text-xs text-[#8A8A8A]">{notification.message}</div>
                    </td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{notification.applications?.business_name || notification.applications?.email || 'All Matching Companies'}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{notification.recipient_type}</td>
                    <td className="px-4 py-4 text-sm text-[#4A4A4A]">{notification.sent_by || '-'}</td>
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
