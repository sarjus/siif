'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import CompanyShell from '@/components/CompanyShell';
import { Card } from '@/components/ui/card';
import ConferenceCalendar, { type Booking } from '@/components/ConferenceCalendar';

export default function CompanyConferencePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Booking request form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', startTime: '09:00', endTime: '10:00' });
  const [submitting, setSubmitting] = useState(false);

  // Booking detail modal
  const [selected, setSelected] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadBookings = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }

      const role = String(session.user.user_metadata?.role || '');
      if (role !== 'company') { router.push('/login'); return; }

      const { data: app } = await supabase
        .from('applications')
        .select('id, business_name, email')
        .ilike('email', session.user.email || '')
        .eq('status', 'approved')
        .maybeSingle();

      if (!app) { router.push('/login'); return; }
      setCompanyId(app.id);
      setCompanyName(app.business_name || app.email);

      const res = await fetch('/api/conference/bookings', { headers: await getAuthHeaders() });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to load bookings');
      setBookings(payload.bookings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleSlotClick = (date: Date, hour: number) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    const endHour = Math.min(hour + 1, 21);
    setForm({ title: '', date: dateStr, startTime: `${pad(hour)}:00`, endTime: `${pad(endHour)}:00` });
    setShowForm(true);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!form.title.trim() || !form.date || !form.startTime || !form.endTime) {
      setError('All fields are required.'); return;
    }

    // Build local datetime then convert to ISO with timezone offset
    // so Supabase stores the correct UTC time regardless of server timezone
    const toLocalISO = (date: string, time: string) => {
      const local = new Date(`${date}T${time}:00`);
      const tzOffset = -local.getTimezoneOffset(); // offset in minutes
      const sign = tzOffset >= 0 ? '+' : '-';
      const hh = String(Math.floor(Math.abs(tzOffset) / 60)).padStart(2, '0');
      const mm = String(Math.abs(tzOffset) % 60).padStart(2, '0');
      return `${date}T${time}:00${sign}${hh}:${mm}`;
    };

    const startTime = toLocalISO(form.date, form.startTime);
    const endTime = toLocalISO(form.date, form.endTime);

    if (new Date(endTime) <= new Date(startTime)) {
      setError('End time must be after start time.'); return;
    }
    setSubmitting(true); setError(null);
    try {
      const res = await fetch('/api/conference/bookings', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, title: form.title, startTime, endTime }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || 'Failed to submit');
      setNotice('Booking request submitted. Waiting for admin approval.');
      setShowForm(false);
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (booking: Booking) => {
    if (!confirm('Cancel this booking request?')) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/conference/bookings/${booking.id}`, {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error);
      setSelected(null);
      await loadBookings();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  const fmtDT = (dt: string) => new Date(dt).toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <CompanyShell title="Conference Room" subtitle="View bookings and request slots for SIIF conference room" companyName={companyName} onLogout={handleLogout}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      <div className="rounded-xl border border-[#dadce0] overflow-hidden bg-white" style={{ height: 'calc(100vh - 220px)', minHeight: '600px' }}>
        <ConferenceCalendar
          bookings={bookings}
          canRequest
          onSlotClick={handleSlotClick}
          onBookingClick={setSelected}
        />
      </div>

      {/* Request form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Request Booking</h3>
              <button onClick={() => setShowForm(false)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{error}</div>}
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Purpose / Title</label>
                <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Team Meeting, Client Presentation"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Date</label>
                <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Start Time (24hr)</label>
                  <input type="time" value={form.startTime} onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">End Time (24hr)</label>
                  <input type="time" value={form.endTime} onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
              <button onClick={() => setShowForm(false)}
                className="rounded-lg border border-[#E3E7EE] px-4 py-2.5 text-sm font-semibold text-[#344054]">Cancel</button>
            </div>
          </Card>
        </div>
      )}

      {/* Booking detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">{selected.title}</h3>
              <button onClick={() => setSelected(null)} className="text-[#8A8A8A] hover:text-[#344054] text-xl">✕</button>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Company:</span> {selected.applications?.business_name || '-'}</p>
              <p><span className="font-semibold">Start:</span> {fmtDT(selected.start_time)}</p>
              <p><span className="font-semibold">End:</span> {fmtDT(selected.end_time)}</p>
              <p><span className="font-semibold">Status:</span>{' '}
                <span className="font-bold" style={{ color: { approved: '#16A34A', pending: '#F59E0B', rejected: '#DC2626', cancelled: '#9CA3AF' }[selected.status] }}>
                  {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                </span>
              </p>
              {selected.rejection_reason && <p className="rounded bg-[#FFE5E5] p-2 text-[#D32F2F]"><span className="font-semibold">Reason:</span> {selected.rejection_reason}</p>}
            </div>
            {selected.company_id === companyId && (selected.status === 'pending' || selected.status === 'approved') && (
              <button onClick={() => handleCancel(selected)} disabled={cancelling}
                className="mt-4 w-full rounded-lg border border-[#DC2626] px-4 py-2 text-sm font-semibold text-[#DC2626] hover:bg-[#FFE5E5] disabled:opacity-50">
                {cancelling ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            )}
          </Card>
        </div>
      )}
    </CompanyShell>
  );
}
