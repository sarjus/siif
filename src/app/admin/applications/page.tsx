'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import AdminShell from '@/components/AdminShell';

interface Application {
  id: string;
  created_at: string;
  business_name: string;
  lead_name: string;
  email: string;
  mobile_phone: string;
  status: string;
  submitted_at: string;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const session = await getSafeSession();
        if (!session) { router.push('/login'); return; }
        setUserEmail(session.user.email || '');
        const { data, error: fetchError } = await supabase
          .from('applications')
          .select('id, created_at, business_name, lead_name, email, mobile_phone, status, submitted_at')
          .order('submitted_at', { ascending: false });
        if (fetchError) throw fetchError;
        setApplications(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load applications');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [router]);

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const handleDelete = useCallback(async (app: Application) => {
    if (!window.confirm(`Permanently delete "${app.business_name}"?\n\nThis will also remove all associated invoices, payments, deposits, and fee records. This cannot be undone.`)) return;
    setDeletingId(app.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/applications/${app.id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Failed to delete application');
      setApplications((current) => current.filter((a) => a.id !== app.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application');
    } finally {
      setDeletingId(null);
    }
  }, []);

  const filtered = applications.filter((app) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = app.business_name?.toLowerCase().includes(q) ||
      app.lead_name?.toLowerCase().includes(q) || app.email?.toLowerCase().includes(q);
    return matchesSearch && (filterStatus === 'all' || app.status === filterStatus);
  });

  const statusColors: Record<string, string> = {
    submitted: '#9A9A9A', under_review: '#2AA0D3', approved: '#4CAF50', rejected: '#F44336',
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Applications" subtitle="View and manage all incubation applications" userEmail={userEmail} onLogout={handleLogout}>
      {error && <div className="mb-6 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}

      <Card className="p-6 mb-6 border-0 shadow">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Search</label>
            <input type="text" placeholder="Search by name, email or business..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Filter by Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm">
              <option value="all">All Statuses</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-[#4A4A4A]">Total</label>
            <div className="text-3xl font-bold text-[#FF3B3B]">{filtered.length}</div>
          </div>
        </div>
      </Card>

      <Card className="border-0 shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: '#F5F6F7', borderBottom: '2px solid #E5E5E5' }}>
                {['Business Name', 'Lead Name', 'Email', 'Status', 'Submitted', 'Action'].map((h) => (
                  <th key={h} className="px-6 py-4 text-left text-sm font-semibold text-[#4A4A4A]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-[#8A8A8A]">No applications found</td></tr>
              ) : filtered.map((app) => (
                <tr key={app.id} className="border-b border-[#E5E5E5] hover:bg-[#F5F6F7]">
                  <td className="px-6 py-4 text-sm font-medium text-[#4A4A4A]">{app.business_name}</td>
                  <td className="px-6 py-4 text-sm text-[#4A4A4A]">{app.lead_name}</td>
                  <td className="px-6 py-4 text-sm text-[#8A8A8A]">{app.email}</td>
                  <td className="px-6 py-4">
                    <span className="rounded-full px-3 py-1 text-xs font-semibold text-white"
                      style={{ backgroundColor: statusColors[app.status] || '#9A9A9A' }}>
                      {app.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#8A8A8A]">
                    {new Date(app.submitted_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <a href={`/admin/applications/${app.id}`}
                        className="rounded-lg bg-[#FF3B3B] px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-700">
                        View
                      </a>
                      <button onClick={() => handleDelete(app)} disabled={deletingId === app.id}
                        className="rounded-lg border border-[#DC2626] px-4 py-1.5 text-sm font-semibold text-[#DC2626] hover:bg-[#DC2626] hover:text-white disabled:opacity-50 transition-all">
                        {deletingId === app.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AdminShell>
  );
}
