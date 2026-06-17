'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import ConferenceCalendar, { type Booking } from '@/components/ConferenceCalendar';

export default function AdminConferencePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'calendar' | 'requests'>('calendar');

  const loadBookings = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');
      const res = await fetch('/api/conference/bookings', { headers: await getAuthHeaders() });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      setBookings(payload.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleAction = async (bookingId: string, action: 'approve' | 'reject' | 'cancel') => {
    setProcessing(true); setError(null);
    try {
      const res = await fetch(`/api/conference/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, rejectionReason: rejectionReason || undefined }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      setNotice(`Booking ${action}d successfully.`);
      setSelected(null);
      setRejectionReason('');
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} booking`);
    } finally {
      setProcessing(false);
    }
  };

  const fmtDT = (dt: string) => new Date(dt).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell
      title="Conference Room"
      subtitle="Manage bookings and approve or reject slot requests"
      userEmail={userEmail}
      onLogout={handleLogout}
      headerActions={
        pendingBookings.length > 0 ? (
          <span className="rounded-full bg-[#F59E0B] px-3 py-1 text-xs font-bold text-white">
            {pendingBookings.length} Pending
          </span>
        ) : undefined
      }
    >
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-[#E3E7EE]">
        {(['calendar', 'requests'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors ${activeTab === tab ? 'border-[#FF3B3B] text-[#FF3B3B]' : 'border-transparent text-[#667085] hover:text-[#344054]'}`}>
            {tab === 'calendar' ? 'Calendar View' : `Booking Requests${pendingBookings.length > 0 ? ` (${pendingBookings.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Calendar tab */}
      {activeTab === 'calendar' && (
        <div className="rounded-xl border border-[#dadce0] overflow-hidden bg-white" style={{ height: 'calc(100vh - 240px)', minHeight: '600px' }}>
          <ConferenceCalendar bookings={bookings} onBookingClick={setSelected} />
        </div>
      )}

      {/* Requests tab */}
      {activeTab === 'requests' && (
        <Card className="border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7' }}>
                  {['Company', 'Title', 'Start', 'End', 'Requested By', 'Status', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.filter((b) => b.status !== 'cancelled').length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-[#8A8A8A]">No booking requests yet.</td></tr>
                ) : bookings.filter((b) => b.status !== 'cancelled').sort((a, b) => {
                  // pending first
                  if (a.status === 'pending' && b.status !== 'pending') return -1;
                  if (a.status !== 'pending' && b.status === 'pending') return 1;
                  return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
                }).map((b) => (
                  <tr key={b.id} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-sm font-semibold text-[#4A4A4A]">{b.applications?.business_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A]">{b.title}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A] whitespace-nowrap">{fmtDT(b.start_time)}</td>
                    <td className="px-4 py-3 text-sm text-[#4A4A4A] whitespace-nowrap">{fmtDT(b.end_time)}</td>
                    <td className="px-4 py-3 text-sm text-[#8A8A8A]">{b.requested_by || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full px-2 py-1 text-xs font-bold text-white capitalize"
                        style={{ backgroundColor: { approved: '#16A34A', pending: '#F59E0B', rejected: '#DC2626', cancelled: '#9CA3AF' }[b.status] }}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {b.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(b.id, 'approve')} disabled={processing}
                            className="rounded-lg bg-[#16A34A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#15803D] disabled:opacity-50">
                            Approve
                          </button>
                          <button onClick={() => { setSelected(b); setRejectionReason(''); }}
                            className="rounded-lg border border-[#DC2626] px-3 py-1 text-xs font-semibold text-[#DC2626] hover:bg-[#FFE5E5]">
                            Reject
                          </button>
                        </div>
                      )}
                      {b.status === 'approved' && (
                        <button onClick={() => handleAction(b.id, 'cancel')} disabled={processing}
                          className="rounded-lg border border-[#9CA3AF] px-3 py-1 text-xs font-semibold text-[#9CA3AF] hover:bg-[#F8FAFC] disabled:opacity-50">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Booking detail / reject modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            <div className="mb-4 space-y-2 text-sm text-[#4A4A4A]">
              <p><span className="font-semibold">Company:</span> {selected.applications?.business_name || '-'}</p>
              <p><span className="font-semibold">Start:</span> {fmtDT(selected.start_time)}</p>
              <p><span className="font-semibold">End:</span> {fmtDT(selected.end_time)}</p>
              <p><span className="font-semibold">Requested by:</span> {selected.requested_by || '-'}</p>
            </div>
            {selected.status === 'pending' && (
              <>
                <div className="mb-4">
                  <label className="mb-1 block text-sm font-medium">Rejection reason (optional)</label>
                  <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="e.g. Slot unavailable due to maintenance"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleAction(selected.id, 'approve')} disabled={processing}
                    className="flex-1 rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-50">
                    {processing ? '...' : 'Approve'}
                  </button>
                  <button onClick={() => handleAction(selected.id, 'reject')} disabled={processing}
                    className="flex-1 rounded-lg bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50">
                    {processing ? '...' : 'Reject'}
                  </button>
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
