'use client';

import { useEffect, useState, useCallback } from 'react';
import { database, getSafeSession, getAuthHeaders } from '@/lib/database';
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
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [creatingCompany, setCreatingCompany] = useState(false);
  const [createCompanyError, setCreateCompanyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const emptyCompanyForm = {
    businessName: '',
    leadName: '',
    email: '',
    mobilePhone: '',
    postalAddress: '',
    city: '',
    state: '',
    sector: '',
    stageOfStartup: '',
    legalStatus: '',
    businessDescription: '',
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const session = await getSafeSession();
        if (!session) { router.push('/login'); return; }
        setUserEmail(session.user.email || '');
        const { data, error: fetchError } = await database
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

  const handleLogout = async () => { await database.auth.signOut(); router.push('/login'); };

  const openEditCompany = async (app: Application) => {
    setError(null);
    setNotice(null);
    setTemporaryPassword(null);
    setCreateCompanyError(null);
    try {
      const response = await fetch(`/api/admin/companies/${app.id}`, { headers: await getAuthHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load company details.');
      setCompanyForm(result.company);
      setEditingId(app.id);
      setShowCreateCompany(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load company details.');
    }
  };

  const closeCompanyModal = () => {
    setShowCreateCompany(false);
    setEditingId(null);
    setCompanyForm(emptyCompanyForm);
    setCreateCompanyError(null);
  };

  const handleCreateCompany = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreatingCompany(true);
    setCreateCompanyError(null);
    setNotice(null);
    setTemporaryPassword(null);

    if (editingId) {
      try {
        const response = await fetch(`/api/admin/companies/${editingId}`, {
          method: 'PATCH',
          headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify(companyForm),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Failed to update company.');
        setApplications((current) => current.map((a) => (a.id === editingId ? { ...a, ...result.application } : a)));
        closeCompanyModal();
        setNotice('Company details updated.');
      } catch (err) {
        setCreateCompanyError(err instanceof Error ? err.message : 'Failed to update company.');
      } finally {
        setCreatingCompany(false);
      }
      return;
    }

    try {
      const response = await fetch('/api/admin/companies', {
        method: 'POST',
        headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify(companyForm),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to create company.');

      setApplications((current) => [result.application as Application, ...current]);
      setShowCreateCompany(false);
      setCompanyForm(emptyCompanyForm);

      try {
        const emailResponse = await fetch('/api/notifications/company-login-email', {
          method: 'POST',
          headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: result.application.email,
            leadName: result.application.lead_name || 'Founder',
            businessName: result.application.business_name,
            username: result.application.email,
            temporaryPassword: result.temporaryPassword,
            loginUrl: `${window.location.origin}/login`,
          }),
        });
        const emailResult = await emailResponse.json();
        if (!emailResponse.ok) throw new Error(emailResult.error || 'Email could not be sent.');
        setNotice(`Approved company and login created. First-login instructions were emailed to ${result.application.email}.`);
      } catch (emailError) {
        setTemporaryPassword(result.temporaryPassword);
        setNotice(`Company and login were created, but the email could not be sent: ${emailError instanceof Error ? emailError.message : 'Email delivery failed.'} Share the temporary password below with the company.`);
      }
    } catch (err) {
      setCreateCompanyError(err instanceof Error ? err.message : 'Failed to create company.');
    } finally {
      setCreatingCompany(false);
    }
  };

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
      {notice && (
        <div className="mb-6 rounded-lg border border-[#BBF7D0] bg-[#F0FDF4] p-4 text-sm text-[#166534]">
          <p>{notice}</p>
          {temporaryPassword && (
            <p className="mt-2 font-semibold">
              Temporary password: <code className="select-all rounded bg-white px-2 py-1">{temporaryPassword}</code>
            </p>
          )}
          <button onClick={() => { setNotice(null); setTemporaryPassword(null); }}
            className="mt-2 text-xs font-semibold underline">Dismiss</button>
        </div>
      )}

      <div className="mb-6 flex flex-col gap-3 rounded-xl bg-[#FFF7F7] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-[#4A4A4A]">Add an existing incubated company</h2>
          <p className="mt-1 text-sm text-[#777]">Create an approved company record and first-login account from the admin portal.</p>
        </div>
        <button onClick={() => { setCreateCompanyError(null); setEditingId(null); setCompanyForm(emptyCompanyForm); setShowCreateCompany(true); }}
          className="shrink-0 rounded-lg bg-[#FF3B3B] px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
          + Add Company
        </button>
      </div>

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
                      {app.status === 'approved' && (
                        <button onClick={() => openEditCompany(app)}
                          className="rounded-lg border border-[#FF3B3B] px-4 py-1.5 text-sm font-semibold text-[#FF3B3B] hover:bg-[#FF3B3B] hover:text-white transition-all">
                          Edit
                        </button>
                      )}
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

      {showCreateCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            role="dialog" aria-modal="true" aria-labelledby="create-company-title">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="create-company-title" className="text-xl font-semibold text-[#333]">{editingId ? 'Edit Company Details' : 'Add Existing Company'}</h2>
                <p className="mt-1 text-sm text-[#777]">{editingId ? 'Changing the email also changes the company login email.' : 'The company will be marked approved and a login will be created.'}</p>
              </div>
              <button type="button" onClick={closeCompanyModal}
                className="rounded px-2 text-2xl leading-none text-gray-500 hover:bg-gray-100" aria-label="Close">×</button>
            </div>

            {createCompanyError && (
              <div className="mb-4 rounded-lg bg-[#FFE5E5] p-3 text-sm text-[#D32F2F]">{createCompanyError}</div>
            )}
            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  ['businessName', 'Company / Business Name', true],
                  ['leadName', 'Founder / Contact Person', true],
                  ['email', 'Company Login Email', true],
                  ['mobilePhone', 'Mobile Phone', false],
                  ['city', 'City', false],
                  ['state', 'State', false],
                  ['sector', 'Sector', false],
                  ['stageOfStartup', 'Startup Stage', false],
                  ['legalStatus', 'Legal Status', false],
                ] as const).map(([field, label, required]) => (
                  <label key={field} className="block text-sm font-medium text-[#4A4A4A]">
                    {label}{required && <span className="text-red-600"> *</span>}
                    <input
                      type={field === 'email' ? 'email' : 'text'}
                      required={required}
                      maxLength={field === 'mobilePhone' ? 50 : field === 'businessName' || field === 'leadName' ? 255 : field === 'email' ? 320 : undefined}
                      value={companyForm[field]}
                      onChange={(event) => setCompanyForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal"
                    />
                  </label>
                ))}
                <label className="block text-sm font-medium text-[#4A4A4A] sm:col-span-2">
                  Postal Address
                  <textarea rows={2} value={companyForm.postalAddress}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, postalAddress: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
                </label>
                <label className="block text-sm font-medium text-[#4A4A4A] sm:col-span-2">
                  Business Description
                  <textarea rows={3} value={companyForm.businessDescription}
                    onChange={(event) => setCompanyForm((current) => ({ ...current, businessDescription: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
                </label>
              </div>
              {!editingId && <p className="text-xs text-[#777]">
                A secure temporary password will be generated. The account must set a new password at first login.
              </p>}
              <div className="flex justify-end gap-3 border-t pt-4">
                <button type="button" onClick={closeCompanyModal}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700">Cancel</button>
                <button type="submit" disabled={creatingCompany}
                  className="rounded-lg bg-[#FF3B3B] px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                  {creatingCompany ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save Changes' : 'Create Company & Login')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
