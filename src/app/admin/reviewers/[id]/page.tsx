'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import AdminNav from '@/components/AdminNav';

interface Reviewer {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface Assignment {
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
  };
}

const reviewStatusColors: Record<string, string> = {
  pending: '#FFA726',
  in_progress: '#2AA0D3',
  completed: '#4CAF50',
};

const appStatusColors: Record<string, string> = {
  submitted: '#9A9A9A',
  under_review: '#2AA0D3',
  approved: '#4CAF50',
  rejected: '#F44336',
};

export default function ReviewerDetailPage() {
  const [reviewer, setReviewer] = useState<Reviewer | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');

  const params = useParams();
  const router = useRouter();
  const reviewerId = params.id as string;

  const fetchData = useCallback(async () => {
    try {
      const { data: rv, error: rvErr } = await supabase
        .from('reviewers')
        .select('*')
        .eq('id', reviewerId)
        .single();
      if (rvErr) throw rvErr;
      setReviewer(rv);

      const { data: assigns, error: aErr } = await supabase
        .from('application_assignments')
        .select('*, applications(business_name, lead_name, email, status, submitted_at)')
        .eq('reviewer_id', reviewerId)
        .order('assigned_at', { ascending: false });
      if (aErr) throw aErr;
      setAssignments(assigns || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [reviewerId]);

  useEffect(() => {
    const init = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        router.push('/admin/login');
        return;
      }
      await fetchData();
    };
    init();
  }, [router, fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading...</p>
      </div>
    );
  }

  if (!reviewer) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>
          Reviewer not found
        </p>
      </div>
    );
  }

  const stats = {
    pending: assignments.filter((a) => a.review_status === 'pending').length,
    in_progress: assignments.filter((a) => a.review_status === 'in_progress').length,
    completed: assignments.filter((a) => a.review_status === 'completed').length,
  };

  const filtered =
    filterStatus === 'all'
      ? assignments
      : assignments.filter((a) => a.review_status === filterStatus);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>
      {/* Header */}
      <div className="bg-[#F5F6F7] border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#FF3B3B' }}>
                {reviewer.name}
              </h1>
              <p style={{ color: '#8A8A8A', fontSize: '14px', marginTop: '4px' }}>
                {reviewer.email}
              </p>
              <p style={{ color: '#8A8A8A', fontSize: '12px', marginTop: '2px' }}>
                Member since {new Date(reviewer.created_at).toLocaleDateString()}
              </p>
            </div>
            <span
              className="px-4 py-1.5 rounded-full text-white text-sm font-semibold"
              style={{ backgroundColor: reviewer.is_active ? '#4CAF50' : '#9A9A9A' }}
            >
              {reviewer.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <AdminNav />
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
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
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>
            Filter by review status:
          </span>
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

        {/* Assignments Table */}
        <Card className="border-0 shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-lg font-bold" style={{ color: '#4A4A4A' }}>
              Assigned Applications ({filtered.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7', borderBottom: '2px solid #E5E5E5' }}>
                  {[
                    'Business Name',
                    'Lead Name',
                    'App Status',
                    'Review Status',
                    'Assigned On',
                    'Reviewed At',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-6 py-4 text-left"
                      style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center"
                      style={{ color: '#8A8A8A', fontSize: '14px' }}
                    >
                      No applications match this filter.
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <>
                      <tr
                        key={a.id}
                        style={{
                          borderBottom: expandedId === a.id ? 'none' : '1px solid #E5E5E5',
                        }}
                        className="hover:bg-[#F5F6F7]"
                      >
                        <td
                          className="px-6 py-4"
                          style={{ fontWeight: 500, fontSize: '14px', color: '#4A4A4A' }}
                        >
                          {a.applications?.business_name}
                        </td>
                        <td className="px-6 py-4" style={{ fontSize: '14px', color: '#4A4A4A' }}>
                          {a.applications?.lead_name}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-semibold text-white"
                            style={{
                              backgroundColor:
                                appStatusColors[a.applications?.status] || '#9A9A9A',
                            }}
                          >
                            {a.applications?.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className="px-2 py-1 rounded-full text-xs font-semibold text-white"
                            style={{
                              backgroundColor:
                                reviewStatusColors[a.review_status] || '#9A9A9A',
                            }}
                          >
                            {a.review_status.replace('_', ' ')}
                          </span>
                        </td>
                        <td
                          className="px-6 py-4"
                          style={{ fontSize: '13px', color: '#8A8A8A' }}
                        >
                          {new Date(a.assigned_at).toLocaleDateString()}
                        </td>
                        <td
                          className="px-6 py-4"
                          style={{ fontSize: '13px', color: '#8A8A8A' }}
                        >
                          {a.reviewed_at ? new Date(a.reviewed_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <a
                              href={`/admin/applications/${a.application_id}`}
                              className="px-3 py-1 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 text-xs font-semibold"
                            >
                              View App
                            </a>
                            {a.review_comments && (
                              <button
                                onClick={() =>
                                  setExpandedId(expandedId === a.id ? null : a.id)
                                }
                                className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors"
                                style={{ borderColor: '#2AA0D3', color: '#2AA0D3' }}
                              >
                                {expandedId === a.id ? 'Hide' : 'Comments'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {expandedId === a.id && a.review_comments && (
                        <tr
                          key={`${a.id}-comments`}
                          style={{
                            borderBottom: '1px solid #E5E5E5',
                            backgroundColor: '#F0F8FF',
                          }}
                        >
                          <td colSpan={7} className="px-6 py-4">
                            <p
                              style={{
                                fontSize: '12px',
                                fontWeight: 700,
                                color: '#2AA0D3',
                                textTransform: 'uppercase',
                                marginBottom: '8px',
                              }}
                            >
                              Review Comments by {reviewer.name}
                            </p>
                            <p
                              style={{
                                fontSize: '14px',
                                color: '#4A4A4A',
                                lineHeight: '1.7',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {a.review_comments}
                            </p>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
