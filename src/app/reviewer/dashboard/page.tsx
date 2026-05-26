'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';

interface AssignmentRow {
  id: string;
  application_id: string;
  review_status: string;
  review_comments: string | null;
  reviewed_at: string | null;
  assigned_at: string;
  applications: {
    business_name: string;
    lead_name: string;
    email: string;
    status: string;
    submitted_at: string;
    stage_of_startup: string | null;
    sector_domain: string[] | null;
  };
}

const reviewStatusColors: Record<string, string> = {
  pending: '#FFA726',
  in_progress: '#2AA0D3',
  completed: '#4CAF50',
};

export default function ReviewerDashboard() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [reviewerName, setReviewerName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const router = useRouter();

  const fetchData = useCallback(async () => {
    try {
      const session = await getSafeSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }

      // Get reviewer record for this user
      const { data: reviewerData, error: rvErr } = await supabase
        .from('reviewers')
        .select('id, name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (rvErr || !reviewerData) {
        // Not a reviewer — redirect to admin
        router.push('/admin/dashboard');
        return;
      }

      setReviewerName(reviewerData.name);

      const { data: assigns, error: aErr } = await supabase
        .from('application_assignments')
        .select(
          '*, applications(business_name, lead_name, email, status, submitted_at, stage_of_startup, sector_domain)'
        )
        .eq('reviewer_id', reviewerData.id)
        .order('assigned_at', { ascending: false });

      if (aErr) throw aErr;
      setAssignments(assigns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading…</p>
      </div>
    );
  }

  const filtered =
    filterStatus === 'all'
      ? assignments
      : assignments.filter((a) => a.review_status === filterStatus);

  const stats = {
    pending: assignments.filter((a) => a.review_status === 'pending').length,
    in_progress: assignments.filter((a) => a.review_status === 'in_progress').length,
    completed: assignments.filter((a) => a.review_status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>
      {/* Header */}
      <div className="bg-[#F5F6F7] border-b border-gray-200 p-6">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '#FF3B3B' }}>
              My Reviews
            </h1>
            <p style={{ color: '#8A8A8A', fontSize: '14px', marginTop: '4px' }}>
              Welcome, {reviewerName} — review your assigned applications
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {error && (
          <div
            className="mb-6 p-4 rounded-lg text-sm"
            style={{ backgroundColor: '#FFE5E5', color: '#D32F2F' }}
          >
            {error}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Pending', value: stats.pending, color: '#FFA726' },
            { label: 'In Progress', value: stats.in_progress, color: '#2AA0D3' },
            { label: 'Completed', value: stats.completed, color: '#4CAF50' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-0 shadow p-5 text-center">
              <p
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#8A8A8A',
                  textTransform: 'uppercase',
                  marginBottom: '6px',
                }}
              >
                {label}
              </p>
              <p className="text-3xl font-bold" style={{ color }}>
                {value}
              </p>
            </Card>
          ))}
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>Filter:</span>
          {['all', 'pending', 'in_progress', 'completed'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition-all"
              style={{
                backgroundColor:
                  filterStatus === s
                    ? s === 'all'
                      ? '#FF3B3B'
                      : reviewStatusColors[s]
                    : '#F0F0F0',
                color: filterStatus === s ? '#fff' : '#4A4A4A',
              }}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>

        {/* Applications Grid */}
        {filtered.length === 0 ? (
          <p
            className="text-center py-16"
            style={{ color: '#8A8A8A', fontSize: '14px' }}
          >
            No applications to show.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((a) => (
              <Card key={a.id} className="border-0 shadow p-6 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3
                    className="text-base font-bold"
                    style={{ color: '#4A4A4A', flex: 1, marginRight: '12px' }}
                  >
                    {a.applications?.business_name}
                  </h3>
                  <span
                    className="px-2 py-1 rounded-full text-xs font-semibold text-white shrink-0"
                    style={{
                      backgroundColor: reviewStatusColors[a.review_status] || '#9A9A9A',
                    }}
                  >
                    {a.review_status.replace('_', ' ')}
                  </span>
                </div>
                <p style={{ fontSize: '13px', color: '#8A8A8A', marginBottom: '4px' }}>
                  {a.applications?.lead_name} · {a.applications?.email}
                </p>
                {a.applications?.stage_of_startup && (
                  <p style={{ fontSize: '12px', color: '#8A8A8A', marginBottom: '4px' }}>
                    Stage: {a.applications.stage_of_startup}
                  </p>
                )}
                {a.applications?.sector_domain && a.applications.sector_domain.length > 0 && (
                  <p style={{ fontSize: '12px', color: '#8A8A8A', marginBottom: '8px' }}>
                    Sector: {a.applications.sector_domain.join(', ')}
                  </p>
                )}
                <p style={{ fontSize: '12px', color: '#AAAAAA', marginBottom: '12px' }}>
                  Assigned {new Date(a.assigned_at).toLocaleDateString()}
                </p>
                <a
                  href={`/reviewer/applications/${a.application_id}`}
                  className="inline-block w-full text-center py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 transition-all text-sm font-semibold"
                >
                  {a.review_status === 'completed' ? 'View / Edit Review' : 'Start Review'}
                </a>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
