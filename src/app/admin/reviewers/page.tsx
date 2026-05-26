'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase, getSafeSession } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import AdminNav from '@/components/AdminNav';

interface ReviewerRow {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
  pending: number;
  in_progress: number;
  completed: number;
  total: number;
}

const emptyForm = { name: '', email: '', password: '' };

export default function ReviewersPage() {
  const [reviewers, setReviewers] = useState<ReviewerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  const router = useRouter();

  const fetchReviewers = useCallback(async () => {
    try {
      setLoading(true);

      const { data: reviewerList, error: rErr } = await supabase
        .from('reviewers')
        .select('*')
        .order('created_at', { ascending: false });
      if (rErr) throw rErr;

      const { data: counts } = await supabase
        .from('application_assignments')
        .select('reviewer_id, review_status');

      const merged: ReviewerRow[] = (reviewerList || []).map((r) => {
        const mine = (counts || []).filter((c) => c.reviewer_id === r.id);
        return {
          ...r,
          pending: mine.filter((c) => c.review_status === 'pending').length,
          in_progress: mine.filter((c) => c.review_status === 'in_progress').length,
          completed: mine.filter((c) => c.review_status === 'completed').length,
          total: mine.length,
        };
      });

      setReviewers(merged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviewers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const session = await getSafeSession();
      if (!session) {
        router.push('/admin/login');
        return;
      }
      await fetchReviewers();
    };
    init();
  }, [router, fetchReviewers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/create-reviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || 'Failed to create reviewer');
        return;
      }
      setFormData(emptyForm);
      setShowCreate(false);
      await fetchReviewers();
    } catch {
      setCreateError('Failed to create reviewer');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    await supabase.from('reviewers').update({ is_active: !current }).eq('id', id);
    await fetchReviewers();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p style={{ fontFamily: '"Hanken Grotesk", sans-serif', color: '#4A4A4A' }}>Loading...</p>
      </div>
    );
  }

  const totalPending = reviewers.reduce((s, r) => s + r.pending, 0);
  const totalAssigned = reviewers.reduce((s, r) => s + r.total, 0);

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: '"Hanken Grotesk", sans-serif' }}>
      {/* Header */}
      <div className="bg-[#F5F6F7] border-b border-gray-200 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold" style={{ color: '#FF3B3B' }}>
                Reviewers
              </h1>
              <p style={{ color: '#8A8A8A', fontSize: '14px', marginTop: '4px' }}>
                Manage reviewer accounts and application assignments
              </p>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              className="px-6 py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 transition-all"
            >
              + Create Reviewer
            </Button>
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

        {/* Create Reviewer Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md mx-4">
              <h2 className="text-xl font-bold mb-6" style={{ color: '#FF3B3B' }}>
                Create New Reviewer
              </h2>
              {createError && (
                <div
                  className="mb-4 p-3 rounded-lg text-sm"
                  style={{ backgroundColor: '#FFE5E5', color: '#D32F2F' }}
                >
                  {createError}
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                {[
                  { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Enter reviewer name' },
                  { label: 'Email Address', key: 'email', type: 'email', placeholder: 'reviewer@example.com' },
                  { label: 'Temporary Password', key: 'password', type: 'password', placeholder: 'Min. 8 characters' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label
                      className="block mb-1 text-sm font-medium"
                      style={{ color: '#4A4A4A' }}
                    >
                      {label}
                    </label>
                    <input
                      type={type}
                      value={formData[key as keyof typeof formData]}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={placeholder}
                      required
                      minLength={key === 'password' ? 8 : undefined}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:ring-2 focus:ring-[#FF3B3B] focus:border-transparent"
                    />
                  </div>
                ))}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 py-2 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 font-semibold text-sm disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Reviewer'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreate(false);
                      setCreateError(null);
                      setFormData(emptyForm);
                    }}
                    className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                    style={{ color: '#4A4A4A' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Reviewers', value: reviewers.length, color: '#FF3B3B' },
            { label: 'Active', value: reviewers.filter((r) => r.is_active).length, color: '#4CAF50' },
            { label: 'Total Assignments', value: totalAssigned, color: '#2AA0D3' },
            { label: 'Pending Reviews', value: totalPending, color: '#FFA726' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-0 shadow p-5">
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

        {/* Reviewers Table */}
        <Card className="border-0 shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ backgroundColor: '#F5F6F7', borderBottom: '2px solid #E5E5E5' }}>
                  {[
                    'Name',
                    'Email',
                    'Status',
                    'Pending',
                    'In Progress',
                    'Completed',
                    'Total',
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
                {reviewers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-8 text-center"
                      style={{ color: '#8A8A8A', fontSize: '14px' }}
                    >
                      No reviewers yet. Create one to get started.
                    </td>
                  </tr>
                ) : (
                  reviewers.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: '1px solid #E5E5E5' }}
                      className="hover:bg-[#F5F6F7]"
                    >
                      <td
                        className="px-6 py-4"
                        style={{ fontWeight: 500, fontSize: '14px', color: '#4A4A4A' }}
                      >
                        {r.name}
                      </td>
                      <td className="px-6 py-4" style={{ fontSize: '13px', color: '#8A8A8A' }}>
                        {r.email}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                          style={{ backgroundColor: r.is_active ? '#4CAF50' : '#9A9A9A' }}
                        >
                          {r.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        style={{ fontSize: '14px', color: '#FFA726', fontWeight: 600 }}
                      >
                        {r.pending}
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        style={{ fontSize: '14px', color: '#2AA0D3', fontWeight: 600 }}
                      >
                        {r.in_progress}
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        style={{ fontSize: '14px', color: '#4CAF50', fontWeight: 600 }}
                      >
                        {r.completed}
                      </td>
                      <td
                        className="px-6 py-4 text-center"
                        style={{ fontSize: '14px', color: '#FF3B3B', fontWeight: 600 }}
                      >
                        {r.total}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <a
                            href={`/admin/reviewers/${r.id}`}
                            className="px-3 py-1 bg-[#FF3B3B] text-white rounded-lg hover:bg-red-700 text-xs font-semibold"
                          >
                            View
                          </a>
                          <button
                            onClick={() => handleToggleActive(r.id, r.is_active)}
                            className="px-3 py-1 rounded-lg text-xs font-semibold border transition-colors"
                            style={{
                              borderColor: r.is_active ? '#9A9A9A' : '#4CAF50',
                              color: r.is_active ? '#9A9A9A' : '#4CAF50',
                            }}
                          >
                            {r.is_active ? 'Deactivate' : 'Activate'}
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
      </div>
    </div>
  );
}
