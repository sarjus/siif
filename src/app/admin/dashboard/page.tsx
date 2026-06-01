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

export default function AdminDashboard() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const router = useRouter();
  
  // Check authentication and fetch applications
  useEffect(() => {
    const checkAuthAndFetch = async () => {
      try {
        // Check if user is authenticated
        const session = await getSafeSession();
        if (!session) {
          router.push('/login');
          return;
        }

        setUser(session.user);
        
        // Fetch applications
        let query = supabase
          .from('applications')
          .select('id, created_at, business_name, lead_name, email, mobile_phone, status, submitted_at')
          .order('submitted_at', { ascending: false });

        const { data, error: fetchError } = await query;

        if (fetchError) throw fetchError;
        setApplications(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load applications');
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndFetch();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleDelete = useCallback(async (app: Application) => {
    const confirmed = window.confirm(
      `Permanently delete "${app.business_name}"?\n\nThis will also remove all associated invoices, payments, deposits, and fee records. This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingId(app.id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/applications/${app.id}`, {
        method: 'DELETE',
        headers: await getAuthHeaders(),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to delete application');
      }
      setApplications((current) => current.filter((a) => a.id !== app.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete application');
    } finally {
      setDeletingId(null);
    }
  }, []);

  // Filter and search applications
  const filteredApplications = applications.filter(app => {
    const matchesSearch = 
      app.business_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.lead_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || app.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const statusColors: Record<string, string> = {
    submitted: '#9A9A9A',
    under_review: '#2AA0D3',
    approved: '#4CAF50',
    rejected: '#F44336'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading...</p>
      </div>
    );
  }

  return (
    <AdminShell
      title="Admin Dashboard"
      subtitle="Manage incubation applications"
      userEmail={user?.email}
      onLogout={handleLogout}
    >
      {error && (
          <div 
            className="mb-6 p-4 rounded-lg"
            style={{
              backgroundColor: '#FFE5E5',
              color: '#D32F2F',
              fontSize: '14px'
            }}
          >
            {error}
          </div>
        )}

        {/* Filters */}
        <Card className="p-6 mb-6 border-0 shadow">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A',
                  display: 'block',
                  marginBottom: '8px'
                }}
              >
                Search
              </label>
              <input
                type="text"
                placeholder="Search by name, email, or business name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              />
            </div>
            <div>
              <label 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A',
                  display: 'block',
                  marginBottom: '8px'
                }}
              >
                Filter by Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '14px',
                  color: '#4A4A4A'
                }}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div>
              <label 
                style={{
                  fontFamily: '"Hanken Grotesk", sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#4A4A4A',
                  display: 'block',
                  marginBottom: '8px'
                }}
              >
                Total Applications
              </label>
              <div 
                className="text-3xl font-bold"
                style={{ color: '#FF3B3B' }}
              >
                {filteredApplications.length}
              </div>
            </div>
          </div>
        </Card>

        {/* Applications Table */}
        <Card className="border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7', borderBottom: '2px solid #E5E5E5' }}>
                  <th 
                    className="px-6 py-4 text-left"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#4A4A4A'
                    }}
                  >
                    Business Name
                  </th>
                  <th 
                    className="px-6 py-4 text-left"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#4A4A4A'
                    }}
                  >
                    Lead Name
                  </th>
                  <th 
                    className="px-6 py-4 text-left"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#4A4A4A'
                    }}
                  >
                    Email
                  </th>
                  <th 
                    className="px-6 py-4 text-left"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#4A4A4A'
                    }}
                  >
                    Status
                  </th>
                  <th 
                    className="px-6 py-4 text-left"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#4A4A4A'
                    }}
                  >
                    Submitted
                  </th>
                  <th 
                    className="px-6 py-4 text-left"
                    style={{
                      fontFamily: '"Hanken Grotesk", sans-serif',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#4A4A4A'
                    }}
                  >
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredApplications.length === 0 ? (
                  <tr>
                    <td 
                      colSpan={6} 
                      className="px-6 py-8 text-center"
                      style={{
                        fontFamily: '"Hanken Grotesk", sans-serif',
                        fontSize: '14px',
                        color: '#8A8A8A'
                      }}
                    >
                      No applications found
                    </td>
                  </tr>
                ) : (
                  filteredApplications.map((app) => (
                    <tr 
                      key={app.id}
                      style={{ 
                        borderBottom: '1px solid #E5E5E5'
                      }}
                      className="hover:bg-[#F5F6F7]"
                    >
                      <td 
                        className="px-6 py-4"
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '14px',
                          color: '#4A4A4A',
                          fontWeight: 500
                        }}
                      >
                        {app.business_name}
                      </td>
                      <td 
                        className="px-6 py-4"
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '14px',
                          color: '#4A4A4A'
                        }}
                      >
                        {app.lead_name}
                      </td>
                      <td 
                        className="px-6 py-4"
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '13px',
                          color: '#8A8A8A'
                        }}
                      >
                        {app.email}
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className="px-3 py-1 rounded-full text-sm font-semibold text-white"
                          style={{
                            backgroundColor: statusColors[app.status] || '#9A9A9A',
                            fontFamily: '"Hanken Grotesk", sans-serif',
                            fontSize: '12px'
                          }}
                        >
                          {app.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td 
                        className="px-6 py-4"
                        style={{
                          fontFamily: '"Hanken Grotesk", sans-serif',
                          fontSize: '13px',
                          color: '#8A8A8A'
                        }}
                      >
                        {new Date(app.submitted_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/admin/applications/${app.id}`}
                            className="inline-block px-4 py-1 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 transition-all text-sm"
                            style={{ fontFamily: 'var(--font-hanken-grotesk)' }}
                          >
                            View
                          </a>
                          <button
                            onClick={() => handleDelete(app)}
                            disabled={deletingId === app.id}
                            className="inline-block px-4 py-1 bg-white border border-[#DC2626] text-[#DC2626] rounded-lg hover:bg-[#DC2626] hover:text-white transition-all text-sm disabled:opacity-50"
                            style={{ fontFamily: 'var(--font-hanken-grotesk)' }}
                          >
                            {deletingId === app.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
    </AdminShell>
  );
}
