'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import CompanyShell from '@/components/CompanyShell';
import { Card } from '@/components/ui/card';
import { UserPlus } from 'lucide-react';

type Incubatee = {
  id: string; company_id: string; incubatee_id: string | null;
  full_name: string; designation: string; email: string | null;
  mobile: string | null; gender: string | null; date_of_birth: string | null;
  address: string | null; id_type: string | null; id_number: string | null;
  photo_url: string | null; status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null; created_at: string;
};

const STATUS_COLORS = { approved: '#16A34A', pending: '#F59E0B', rejected: '#DC2626' };

const emptyForm = {
  fullName: '', designation: '', email: '', mobile: '',
  gender: '', dateOfBirth: '', address: '',
  idType: '', idNumber: '', photoUrl: '', photoPreview: '',
};

export default function CompanyIncubatyeesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [incubatees, setIncubatees] = useState<Incubatee[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [viewItem, setViewItem] = useState<Incubatee | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const session = await getSafeSession();
    if (!session) { router.push('/login'); return; }
    const role = String(session.user.user_metadata?.role || '');
    if (role !== 'company') { router.push('/login'); return; }

    const { data: app } = await supabase.from('applications')
      .select('id, business_name, email')
      .ilike('email', session.user.email || '')
      .eq('status', 'approved').maybeSingle();
    if (!app) { router.push('/login'); return; }

    setCompanyId(app.id);
    setCompanyName(app.business_name || app.email);

    try {
      const res = await fetch(`/api/company/incubatees?companyId=${app.id}`, {
        headers: await getAuthHeaders(),
      });
      const p = await res.json();
      if (res.ok) setIncubatees(p.incubatees || []);
    } catch { /* silent */ }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setError('Photo must be under 2MB.'); return; }

    setUploading(true); setError(null);
    try {
      const preview = URL.createObjectURL(file);
      setForm(p => ({ ...p, photoPreview: preview }));

      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch('/api/company/incubatees/upload-photo', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm(p => ({ ...p, photoUrl: data.photoUrl, photoPreview: data.signedUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.designation.trim()) {
      setError('Full name and designation are required.'); return;
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        companyId, fullName: form.fullName, designation: form.designation,
        email: form.email || null, mobile: form.mobile || null,
        gender: form.gender || null, dateOfBirth: form.dateOfBirth || null,
        address: form.address || null, idType: form.idType || null,
        idNumber: form.idNumber || null, photoUrl: form.photoUrl || null,
      };

      const res = await fetch('/api/company/incubatees', {
        method: editId ? 'PUT' : 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(editId ? { ...payload, id: editId } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setNotice(editId ? 'Entry updated.' : 'Entry submitted for admin approval.');
      setShowForm(false); setEditId(null); setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: Incubatee) => {
    setEditId(item.id);
    setForm({
      fullName: item.full_name, designation: item.designation,
      email: item.email || '', mobile: item.mobile || '',
      gender: item.gender || '', dateOfBirth: item.date_of_birth || '',
      address: item.address || '', idType: item.id_type || '',
      idNumber: item.id_number || '', photoUrl: item.photo_url || '',
      photoPreview: item.photo_url || '',
    });
    setShowForm(true); setError(null);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <CompanyShell title="Team Directory" subtitle="Add and manage your company's incubatee profiles"
      companyName={companyName} onLogout={handleLogout}
      headerActions={
        <button onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); setError(null); }}
          className="flex items-center gap-2 rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
          <UserPlus className="size-4" /> Add Member
        </button>
      }>
      {error && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      {incubatees.length === 0 ? (
        <Card className="border-0 shadow p-12 text-center">
          <UserPlus className="mx-auto mb-4 size-12 text-[#E3E7EE]" />
          <p className="text-[#8A8A8A]">No team members added yet. Click "Add Member" to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {incubatees.map((item) => (
            <Card key={item.id} className="border-0 shadow p-5 flex flex-col items-center text-center gap-3 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setViewItem(item)}>
              {/* Photo */}
              <div className="h-20 w-20 rounded-full overflow-hidden bg-[#F5F6F7] border-2 border-[#E3E7EE] flex items-center justify-center">
                {item.photo_url ? (
                  <img src={`/api/company/incubatees/photo?path=${encodeURIComponent(item.photo_url)}`}
                    alt={item.full_name} className="h-full w-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <span className="text-2xl font-bold text-[#9CA3AF]">
                    {item.full_name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-bold text-[#172033]">{item.full_name}</p>
                <p className="text-sm text-[#667085]">{item.designation}</p>
                {item.incubatee_id && (
                  <p className="mt-1 text-xs font-mono font-bold text-[#1a73e8]">{item.incubatee_id}</p>
                )}
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white capitalize"
                style={{ backgroundColor: STATUS_COLORS[item.status] }}>
                {item.status}
              </span>
              {item.status === 'pending' && (
                <button onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                  className="text-xs text-[#FF3B3B] hover:underline font-semibold">
                  Edit
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-2xl border-0 shadow-2xl p-6 bg-white max-h-[92vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">{editId ? 'Edit Member' : 'Add Team Member'}</h3>
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="text-[#8A8A8A] text-xl">✕</button>
            </div>
            {error && <div className="mb-3 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{error}</div>}

            {/* Photo upload */}
            <div className="mb-5 flex flex-col items-center gap-3">
              <div className="h-24 w-24 rounded-full overflow-hidden bg-[#F5F6F7] border-2 border-dashed border-[#E3E7EE] flex items-center justify-center">
                {form.photoPreview ? (
                  <img src={form.photoPreview} alt="Preview" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[#9CA3AF] text-sm text-center px-2">Passport Photo</span>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePhotoChange} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="rounded-lg border border-[#E3E7EE] px-4 py-1.5 text-sm font-semibold text-[#344054] hover:bg-[#F8FAFC] disabled:opacity-50">
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </button>
              <p className="text-[11px] text-[#8A8A8A]">JPEG/PNG, max 2MB, passport size</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['Full Name *', 'fullName', 'text', 'As per ID proof'],
                ['Designation *', 'designation', 'text', 'e.g. Co-Founder, Developer'],
                ['Email', 'email', 'email', 'Work email address'],
                ['Mobile', 'mobile', 'tel', 'Phone number'],
                ['Date of Birth', 'dateOfBirth', 'date', ''],
              ].map(([label, key, type, placeholder]) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-[#344054]">{label}</label>
                  <input type={type} value={form[key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-sm font-medium text-[#344054]">Gender</label>
                <select value={form.gender} onChange={e => setForm(p => ({ ...p, gender: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm">
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#344054]">ID Proof Type</label>
                <select value={form.idType} onChange={e => setForm(p => ({ ...p, idType: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm">
                  <option value="">Select</option>
                  <option value="aadhaar">Aadhaar</option>
                  <option value="pan">PAN Card</option>
                  <option value="passport">Passport</option>
                  <option value="voter_id">Voter ID</option>
                  <option value="driving_license">Driving License</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#344054]">ID Number</label>
                <input value={form.idNumber} onChange={e => setForm(p => ({ ...p, idNumber: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-[#344054]">Address</label>
                <textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  rows={2} className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button onClick={handleSave} disabled={saving || uploading}
                className="flex-1 rounded-lg bg-[#FF3B3B] px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {saving ? 'Saving...' : editId ? 'Update' : 'Submit for Approval'}
              </button>
              <button onClick={() => { setShowForm(false); setEditId(null); }}
                className="rounded-lg border border-[#E3E7EE] px-4 py-2.5 text-sm font-semibold text-[#344054]">
                Cancel
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* View Details Modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-md border-0 shadow-2xl p-6 bg-white max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#172033]">Member Details</h3>
              <button onClick={() => setViewItem(null)} className="text-[#8A8A8A] text-xl">✕</button>
            </div>
            <div className="flex flex-col items-center gap-3 mb-5">
              <div className="h-24 w-24 rounded-full overflow-hidden bg-[#F5F6F7] border border-[#E3E7EE] flex items-center justify-center">
                {viewItem.photo_url ? (
                  <img src={`/api/company/incubatees/photo?path=${encodeURIComponent(viewItem.photo_url)}`}
                    alt={viewItem.full_name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-[#9CA3AF]">{viewItem.full_name.charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-[#172033]">{viewItem.full_name}</p>
                <p className="text-sm text-[#667085]">{viewItem.designation}</p>
                {viewItem.incubatee_id && (
                  <p className="mt-1 text-sm font-mono font-bold text-[#1a73e8] bg-[#EFF6FF] rounded px-2 py-0.5 inline-block">
                    {viewItem.incubatee_id}
                  </p>
                )}
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white capitalize"
                style={{ backgroundColor: STATUS_COLORS[viewItem.status] }}>
                {viewItem.status}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ['Email', viewItem.email], ['Mobile', viewItem.mobile],
                ['Gender', viewItem.gender], ['Date of Birth', viewItem.date_of_birth],
                ['ID Type', viewItem.id_type?.replace('_', ' ')], ['ID Number', viewItem.id_number],
                ['Address', viewItem.address],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={String(label)} className="flex gap-2">
                  <span className="w-28 shrink-0 font-semibold text-[#4A4A4A]">{label}:</span>
                  <span className="text-[#667085] capitalize">{String(value)}</span>
                </div>
              ))}
              {viewItem.rejection_reason && (
                <div className="rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">
                  <strong>Rejection reason:</strong> {viewItem.rejection_reason}
                </div>
              )}
            </div>
            <button onClick={() => setViewItem(null)}
              className="mt-5 w-full rounded-lg bg-[#172033] px-4 py-2 text-sm font-semibold text-white">
              Close
            </button>
          </Card>
        </div>
      )}
    </CompanyShell>
  );
}
