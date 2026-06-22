'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { Camera, Pencil, Check, X } from 'lucide-react';

type Incubatee = {
  id: string; company_id: string; incubatee_id: string | null;
  full_name: string; designation: string; email: string | null;
  mobile: string | null; gender: string | null; date_of_birth: string | null;
  address: string | null; id_type: string | null; id_number: string | null;
  photo_url: string | null; signed_photo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null; reviewed_by: string | null;
  reviewed_at: string | null; created_at: string;
  applications?: { business_name: string | null; email: string } | null;
};

const STATUS_COLORS = { approved: '#16A34A', pending: '#F59E0B', rejected: '#DC2626' };

export default function AdminIncubatyeesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [incubatees, setIncubatees] = useState<Incubatee[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Incubatee | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Edit incubatee ID state
  const [editingId, setEditingId] = useState(false);
  const [editIdValue, setEditIdValue] = useState('');
  const [savingId, setSavingId] = useState(false);

  const load = useCallback(async () => {
    const session = await getSafeSession();
    if (!session) { router.push('/login'); return; }
    setUserEmail(session.user.email || '');
    try {
      const res = await fetch('/api/admin/incubatees', { headers: await getAuthHeaders() });
      const p = await res.json();
      if (res.ok) setIncubatees(p.incubatees || []);
      else throw new Error(p.error);
    } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return incubatees.filter(i => {
      const matchStatus = statusFilter === 'all' || i.status === statusFilter;
      const matchSearch = !q || i.full_name.toLowerCase().includes(q) ||
        (i.applications?.business_name || '').toLowerCase().includes(q) ||
        (i.incubatee_id || '').toLowerCase().includes(q) ||
        (i.email || '').toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [incubatees, statusFilter, search]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2MB.'); return; }

    setUploading(true); setError(null);
    try {
      const preview = URL.createObjectURL(file);
      setPhotoPreview(preview);

      const fd = new FormData();
      fd.append('photo', file);
      fd.append('incubateeId', selected.id);

      const res = await fetch('/api/admin/incubatees/upload-photo', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setPhotoPreview(data.signedUrl || preview);
      // Update selected to reflect new photo_url and signed_photo_url
      setSelected(prev => prev ? { ...prev, photo_url: data.photoUrl, signed_photo_url: data.signedUrl ?? null } : prev);
      setNotice('Photo uploaded successfully.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhotoPreview(null);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectionReason.trim()) {
      setError('Please provide a rejection reason.'); return;
    }
    setProcessing(true); setError(null);
    try {
      const res = await fetch('/api/admin/incubatees', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ incubateeId: id, action, rejectionReason: rejectionReason || undefined }),
      });
      const p = await res.json();
      if (!res.ok) throw new Error(p.error || 'Failed');
      if (action === 'approve') {
        setNotice(`Approved! Incubatee ID: ${p.incubatee?.incubatee_id}`);
      } else {
        setNotice('Entry rejected.');
      }
      setSelected(null); setRejectionReason('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveId = async () => {
    if (!selected) return;
    const trimmed = editIdValue.trim().toUpperCase();
    if (!trimmed) { setError('Incubatee ID cannot be empty.'); return; }
    if (!/^\d{2}SIIF\d{3}$/.test(trimmed)) {
      setError('Invalid format. Use YYSIIFnnn (e.g. 26SIIF001).'); return;
    }
    setSavingId(true); setError(null);
    try {
      const res = await fetch('/api/admin/incubatees', {
        method: 'PATCH',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ incubateeId: selected.id, newIncubateeId: trimmed }),
      });
      const p = await res.json();
      if (!res.ok) throw new Error(p.error || 'Failed');
      setNotice(`Incubatee ID updated to ${trimmed}.`);
      setSelected(prev => prev ? { ...prev, incubatee_id: trimmed } : prev);
      setEditingId(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSavingId(false);
    }
  };

  const pendingCount = incubatees.filter(i => i.status === 'pending').length;
  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Incubatee Directory" subtitle="Verify and manage incubatee registrations"
      userEmail={userEmail} onLogout={handleLogout}
      headerActions={pendingCount > 0 ? (
        <span className="rounded-full bg-[#F59E0B] px-3 py-1 text-xs font-bold text-white">
          {pendingCount} Pending
        </span>
      ) : undefined}>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ['Total', incubatees.length, '#344054'],
          ['Approved', incubatees.filter(i => i.status === 'approved').length, '#16A34A'],
          ['Pending', pendingCount, '#F59E0B'],
          ['Rejected', incubatees.filter(i => i.status === 'rejected').length, '#DC2626'],
        ].map(([l, v, c]) => (
          <Card key={String(l)} className="border-0 shadow p-5">
            <p className="text-xs font-bold uppercase text-[#8A8A8A]">{l}</p>
            <p className="text-2xl font-bold" style={{ color: String(c) }}>{v}</p>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="mb-4 border-0 shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, company, ID..."
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm" />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm">
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </Card>

      {/* Grid view */}
      {filtered.length === 0 ? (
        <Card className="border-0 shadow p-10 text-center text-sm text-[#8A8A8A]">No entries found.</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => (
            <Card key={item.id}
              className="border-0 shadow p-5 flex flex-col items-center text-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => { setSelected(item); setRejectionReason(''); setError(null); setPhotoPreview(null); }}>
              {/* Photo */}
              <div className="h-20 w-20 rounded-full overflow-hidden bg-[#F5F6F7] border-2 border-[#E3E7EE] flex items-center justify-center">
                {item.signed_photo_url ? (
                  <img src={item.signed_photo_url}
                    alt={item.full_name} className="h-full w-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="text-2xl font-bold text-[#9CA3AF]">{item.full_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-bold text-[#172033]">{item.full_name}</p>
                <p className="text-sm text-[#667085]">{item.designation}</p>
                <p className="text-xs text-[#8A8A8A]">{item.applications?.business_name || '-'}</p>
                {item.incubatee_id && (
                  <p className="mt-1 text-xs font-mono font-bold text-[#1a73e8]">{item.incubatee_id}</p>
                )}
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white capitalize"
                style={{ backgroundColor: STATUS_COLORS[item.status] }}>
                {item.status}
              </span>
            </Card>
          ))}
        </div>
      )}

      {/* Detail / Approve / Reject Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg border-0 shadow-2xl p-6 bg-white max-h-[92vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Incubatee Details</h3>
              <button onClick={() => { setSelected(null); setPhotoPreview(null); setEditingId(false); setEditIdValue(''); }} className="text-[#8A8A8A] text-xl">✕</button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{error}</div>}

            {/* Photo + name */}
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="relative">
                <div className="h-28 w-28 rounded-full overflow-hidden bg-[#F5F6F7] border-2 border-[#E3E7EE] flex items-center justify-center">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                  ) : selected.signed_photo_url ? (
                    <img src={selected.signed_photo_url}
                      alt={selected.full_name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-3xl font-bold text-[#9CA3AF]">{selected.full_name.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {/* Upload button overlay */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  title="Upload photo"
                  className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-[#FF3B3B] text-white shadow-md hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Camera className="size-4" />
                  )}
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  className="hidden" onChange={handlePhotoUpload} />
              </div>
              <p className="text-[11px] text-[#8A8A8A]">Click camera icon to upload photo (max 2MB)</p>
              <div className="text-center">
                <p className="text-lg font-bold text-[#172033]">{selected.full_name}</p>
                <p className="text-sm text-[#667085]">{selected.designation}</p>
                <p className="text-xs text-[#8A8A8A]">{selected.applications?.business_name || '-'}</p>
                {selected.incubatee_id && (
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    {editingId ? (
                      <>
                        <input
                          value={editIdValue}
                          onChange={e => setEditIdValue(e.target.value.toUpperCase())}
                          maxLength={9}
                          placeholder="26SIIF001"
                          className="w-28 rounded border border-[#1a73e8] bg-[#EFF6FF] px-2 py-0.5 text-center text-sm font-mono font-bold text-[#1a73e8] outline-none focus:ring-2 focus:ring-[#1a73e8]"
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveId(); if (e.key === 'Escape') { setEditingId(false); setError(null); } }}
                          autoFocus
                        />
                        <button
                          onClick={handleSaveId}
                          disabled={savingId}
                          title="Save"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#16A34A] text-white hover:bg-[#15803D] disabled:opacity-50"
                        >
                          {savingId ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Check className="size-3.5" />}
                        </button>
                        <button
                          onClick={() => { setEditingId(false); setError(null); }}
                          title="Cancel"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#8A8A8A] text-white hover:bg-[#6B6B6B]"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="rounded bg-[#EFF6FF] px-2 py-0.5 text-sm font-mono font-bold text-[#1a73e8]">
                          {selected.incubatee_id}
                        </span>
                        {selected.status === 'approved' && (
                          <button
                            onClick={() => { setEditingId(true); setEditIdValue(selected.incubatee_id ?? ''); setError(null); }}
                            title="Edit Incubatee ID"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F3F4F6] text-[#667085] hover:bg-[#E5E7EB] hover:text-[#172033] transition-colors"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white capitalize"
                style={{ backgroundColor: STATUS_COLORS[selected.status] }}>
                {selected.status}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm mb-5">
              {[
                ['Email', selected.email], ['Mobile', selected.mobile],
                ['Gender', selected.gender], ['Date of Birth', selected.date_of_birth],
                ['ID Type', selected.id_type?.replace(/_/g, ' ')], ['ID Number', selected.id_number],
                ['Address', selected.address],
                ['Submitted By', selected.applications?.email],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={String(l)} className="flex gap-2">
                  <span className="w-28 shrink-0 font-semibold text-[#4A4A4A]">{l}:</span>
                  <span className="text-[#667085] capitalize">{String(v)}</span>
                </div>
              ))}
              {selected.rejection_reason && (
                <div className="rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">
                  <strong>Rejection reason:</strong> {selected.rejection_reason}
                </div>
              )}
            </div>

            {/* Actions */}
            {selected.status === 'pending' && (
              <div className="space-y-3 border-t border-[#E3E7EE] pt-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Rejection Reason (required if rejecting)</label>
                  <input value={rejectionReason} onChange={e => setRejectionReason(e.target.value)}
                    placeholder="e.g. Incomplete information, invalid ID proof"
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => handleAction(selected.id, 'approve')} disabled={processing}
                    className="flex-1 rounded-lg bg-[#16A34A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#15803D] disabled:opacity-50">
                    {processing ? '...' : '✓ Approve & Issue ID'}
                  </button>
                  <button onClick={() => handleAction(selected.id, 'reject')} disabled={processing}
                    className="flex-1 rounded-lg bg-[#DC2626] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50">
                    {processing ? '...' : '✕ Reject'}
                  </button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </AdminShell>
  );
}

