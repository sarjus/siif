'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getSafeSession, getAuthHeaders } from '@/lib/supabase';
import AdminShell from '@/components/AdminShell';
import { Card } from '@/components/ui/card';
import { Fingerprint, Monitor, Link2, RefreshCw, Plus, Trash2, Wifi, WifiOff } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Device = {
  id: string; serial_no: string; name: string; location: string | null;
  last_seen: string | null; enabled: boolean; created_at: string;
};

type AttLog = {
  id: string; device_sn: string; pin: string; punch_time: string;
  punch_type: number; verify_type: number; work_code: string | null;
  incubatee_id: string | null;
  incubatees?: {
    full_name: string; incubatee_id: string | null; designation: string;
    applications?: { business_name: string | null } | null;
  } | null;
  attendance_devices?: { name: string; location: string | null } | null;
};

type Mapping = {
  id: string; device_sn: string; pin: string; created_at: string;
  incubatees?: {
    id: string; full_name: string; incubatee_id: string | null;
    designation: string;
    applications?: { business_name: string | null } | null;
  } | null;
};

type Incubatee = {
  id: string; full_name: string; incubatee_id: string | null;
  designation: string;
  applications?: { business_name: string | null } | null;
};

const PUNCH_LABELS: Record<number, string> = { 0: 'Check-In', 1: 'Check-Out', 4: 'OT-In', 5: 'OT-Out' };
const PUNCH_COLORS: Record<number, string> = { 0: '#16A34A', 1: '#DC2626', 4: '#2563EB', 5: '#9333EA' };
const VERIFY_LABELS: Record<number, string> = { 1: 'Fingerprint', 4: 'Card', 15: 'Face', 200: 'Duress' };

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

type Tab = 'logs' | 'devices' | 'mapping';

export default function AttendancePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('logs');

  // Logs state
  const [logs, setLogs] = useState<AttLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterPin, setFilterPin] = useState('');
  const [filterDevice, setFilterDevice] = useState('');
  const [filterPunchType, setFilterPunchType] = useState('');

  // Devices state
  const [devices, setDevices] = useState<Device[]>([]);
  const [newDeviceSn, setNewDeviceSn] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');
  const [newDeviceLocation, setNewDeviceLocation] = useState('');
  const [savingDevice, setSavingDevice] = useState(false);

  // Mapping state
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [incubatees, setIncubatees] = useState<Incubatee[]>([]);
  const [mapDeviceSn, setMapDeviceSn] = useState('');
  const [mapPin, setMapPin] = useState('');
  const [mapIncubateeId, setMapIncubateeId] = useState('');
  const [savingMap, setSavingMap] = useState(false);

  // ─── Data loaders ─────────────────────────────────────────────────────────
  const loadLogs = useCallback(async (pg = 1) => {
    const params = new URLSearchParams({ page: String(pg), pageSize: '50' });
    if (filterFrom)      params.set('from', filterFrom);
    if (filterTo)        params.set('to', filterTo);
    if (filterPin)       params.set('pin', filterPin);
    if (filterDevice)    params.set('deviceSn', filterDevice);
    if (filterPunchType) params.set('punchType', filterPunchType);

    const res = await fetch(`/api/admin/attendance/logs?${params}`, { headers: await getAuthHeaders() });
    const p = await res.json();
    if (res.ok) {
      setLogs(p.logs); setTotal(p.total);
      setPage(p.page); setTotalPages(p.totalPages);
    } else { setError(p.error); }
  }, [filterFrom, filterTo, filterPin, filterDevice, filterPunchType]);

  const loadDevices = useCallback(async () => {
    const res = await fetch('/api/admin/attendance/devices', { headers: await getAuthHeaders() });
    const p = await res.json();
    if (res.ok) setDevices(p.devices);
    else setError(p.error);
  }, []);

  const loadMappings = useCallback(async () => {
    const res = await fetch('/api/admin/attendance/mapping', { headers: await getAuthHeaders() });
    const p = await res.json();
    if (res.ok) setMappings(p.mappings);
    else setError(p.error);
  }, []);

  const loadIncubatees = useCallback(async () => {
    const res = await fetch('/api/admin/incubatees', { headers: await getAuthHeaders() });
    const p = await res.json();
    if (res.ok) setIncubatees((p.incubatees || []).filter((i: { status: string }) => i.status === 'approved'));
  }, []);

  useEffect(() => {
    (async () => {
      const session = await getSafeSession();
      if (!session) { router.push('/login'); return; }
      setUserEmail(session.user.email || '');
      await Promise.all([loadLogs(1), loadDevices(), loadMappings(), loadIncubatees()]);
      setLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Device actions ───────────────────────────────────────────────────────
  const handleAddDevice = async () => {
    if (!newDeviceSn.trim() || !newDeviceName.trim()) {
      setError('Serial number and name are required.'); return;
    }
    setSavingDevice(true); setError(null);
    const res = await fetch('/api/admin/attendance/devices', {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ serialNo: newDeviceSn.trim(), name: newDeviceName.trim(), location: newDeviceLocation.trim() }),
    });
    const p = await res.json();
    if (res.ok) {
      setNotice('Device registered.'); setNewDeviceSn(''); setNewDeviceName(''); setNewDeviceLocation('');
      await loadDevices();
    } else { setError(p.error); }
    setSavingDevice(false);
  };

  const handleToggleDevice = async (device: Device) => {
    const res = await fetch('/api/admin/attendance/devices', {
      method: 'PATCH',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: device.id, enabled: !device.enabled }),
    });
    if (res.ok) { setNotice('Device updated.'); await loadDevices(); }
    else { const p = await res.json(); setError(p.error); }
  };

  // ─── Mapping actions ──────────────────────────────────────────────────────
  const handleAddMapping = async () => {
    if (!mapDeviceSn.trim() || !mapPin.trim() || !mapIncubateeId) {
      setError('Device SN, PIN, and incubatee are required.'); return;
    }
    setSavingMap(true); setError(null);
    const res = await fetch('/api/admin/attendance/mapping', {
      method: 'POST',
      headers: { ...(await getAuthHeaders()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceSn: mapDeviceSn.trim(), pin: mapPin.trim(), incubateeId: mapIncubateeId }),
    });
    const p = await res.json();
    if (res.ok) {
      setNotice('Mapping saved and existing logs updated.');
      setMapDeviceSn(''); setMapPin(''); setMapIncubateeId('');
      await Promise.all([loadMappings(), loadLogs(1)]);
    } else { setError(p.error); }
    setSavingMap(false);
  };

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Remove this PIN mapping?')) return;
    const res = await fetch(`/api/admin/attendance/mapping?id=${id}`, {
      method: 'DELETE', headers: await getAuthHeaders(),
    });
    if (res.ok) { setNotice('Mapping removed.'); await loadMappings(); }
    else { const p = await res.json(); setError(p.error); }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push('/login'); };

  // ─── Derived stats ────────────────────────────────────────────────────────
  const todayLogs = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return logs.filter(l => l.punch_time.startsWith(today));
  }, [logs]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return (
    <AdminShell title="Attendance" subtitle="eSSL F22 Pro — real-time biometric attendance tracking"
      userEmail={userEmail} onLogout={handleLogout}>
      {error  && <div className="mb-4 rounded-lg bg-[#FFE5E5] p-4 text-sm text-[#D32F2F]">{error}</div>}
      {notice && <div className="mb-4 rounded-lg bg-[#EAF9F0] p-4 text-sm font-semibold text-[#1E7F46]">{notice}</div>}

      {/* Summary cards */}
      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          ['Total Logs', total, '#344054', <Fingerprint key="f" className="size-5" />],
          ["Today's Punches", todayLogs.length, '#2563EB', <RefreshCw key="r" className="size-5" />],
          ['Devices', devices.length, '#16A34A', <Monitor key="m" className="size-5" />],
          ['Mappings', mappings.length, '#9333EA', <Link2 key="l" className="size-5" />],
        ].map(([label, value, color, icon]) => (
          <Card key={String(label)} className="border-0 shadow p-5 flex items-center gap-4">
            <div className="rounded-full p-2" style={{ backgroundColor: `${color}18`, color: String(color) }}>{icon}</div>
            <div>
              <p className="text-xs font-bold uppercase text-[#8A8A8A]">{label}</p>
              <p className="text-2xl font-bold" style={{ color: String(color) }}>{value}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-[#E3E7EE] pb-0">
        {([['logs', 'Attendance Logs'], ['devices', 'Devices'], ['mapping', 'PIN Mapping']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === t ? 'border-[#FF3B3B] text-[#FF3B3B]' : 'border-transparent text-[#667085] hover:text-[#172033]'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── LOGS TAB ── */}
      {tab === 'logs' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-[#8A8A8A]">From</label>
                <input type="datetime-local" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-[#8A8A8A]">To</label>
                <input type="datetime-local" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-[#8A8A8A]">Device PIN</label>
                <input value={filterPin} onChange={e => setFilterPin(e.target.value)} placeholder="e.g. 1"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-[#8A8A8A]">Device SN</label>
                <select value={filterDevice} onChange={e => setFilterDevice(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">All Devices</option>
                  {devices.map(d => <option key={d.serial_no} value={d.serial_no}>{d.name || d.serial_no}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold uppercase text-[#8A8A8A]">Punch Type</label>
                <select value={filterPunchType} onChange={e => setFilterPunchType(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">All</option>
                  <option value="0">Check-In</option>
                  <option value="1">Check-Out</option>
                  <option value="4">OT-In</option>
                  <option value="5">OT-Out</option>
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => loadLogs(1)}
                className="rounded-lg bg-[#FF3B3B] px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Apply Filters
              </button>
              <button onClick={() => { setFilterFrom(''); setFilterTo(''); setFilterPin(''); setFilterDevice(''); setFilterPunchType(''); setTimeout(() => loadLogs(1), 0); }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-[#667085] hover:bg-gray-50">
                Clear
              </button>
            </div>
          </Card>

          {/* Logs table */}
          <Card className="border-0 shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-[#8A8A8A] text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Date / Time</th>
                    <th className="px-4 py-3 text-left font-bold">Person</th>
                    <th className="px-4 py-3 text-left font-bold">Company</th>
                    <th className="px-4 py-3 text-left font-bold">Device PIN</th>
                    <th className="px-4 py-3 text-left font-bold">Punch</th>
                    <th className="px-4 py-3 text-left font-bold">Verify</th>
                    <th className="px-4 py-3 text-left font-bold">Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {logs.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-[#8A8A8A]">No logs found.</td></tr>
                  ) : logs.map(log => (
                    <tr key={log.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                        {new Date(log.punch_time).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                      </td>
                      <td className="px-4 py-3">
                        {log.incubatees ? (
                          <div>
                            <p className="font-semibold text-[#172033]">{log.incubatees.full_name}</p>
                            <p className="text-[11px] text-[#8A8A8A]">{log.incubatees.designation}</p>
                            {log.incubatees.incubatee_id && (
                              <span className="text-[11px] font-mono text-[#1a73e8]">{log.incubatees.incubatee_id}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[#8A8A8A] italic">Unmapped PIN</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#667085]">
                        {log.incubatees?.applications?.business_name || '—'}
                      </td>
                      <td className="px-4 py-3 font-mono text-[#344054]">{log.pin}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                          style={{ backgroundColor: PUNCH_COLORS[log.punch_type] ?? '#8A8A8A' }}>
                          {PUNCH_LABELS[log.punch_type] ?? `Type ${log.punch_type}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[#667085] text-xs">
                        {VERIFY_LABELS[log.verify_type] ?? `#${log.verify_type}`}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#8A8A8A]">
                        {log.attendance_devices?.name || log.device_sn}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#E3E7EE] px-4 py-3">
                <p className="text-xs text-[#8A8A8A]">
                  {total} total records &nbsp;·&nbsp; Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => loadLogs(page - 1)}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">← Prev</button>
                  <button disabled={page >= totalPages} onClick={() => loadLogs(page + 1)}
                    className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-40">Next →</button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── DEVICES TAB ── */}
      {tab === 'devices' && (
        <div className="space-y-4">
          {/* Register new device */}
          <Card className="border-0 shadow p-5">
            <h3 className="mb-3 font-bold text-[#172033]">Register New Device</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A4A4A]">Serial Number *</label>
                <input value={newDeviceSn} onChange={e => setNewDeviceSn(e.target.value)}
                  placeholder="e.g. CJKB240900001"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A4A4A]">Friendly Name *</label>
                <input value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)}
                  placeholder="e.g. Main Entrance"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A4A4A]">Location</label>
                <input value={newDeviceLocation} onChange={e => setNewDeviceLocation(e.target.value)}
                  placeholder="e.g. SIIF Ground Floor"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleAddDevice} disabled={savingDevice}
              className="mt-3 flex items-center gap-2 rounded-lg bg-[#172033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F172A] disabled:opacity-50">
              <Plus className="size-4" /> {savingDevice ? 'Saving…' : 'Register Device'}
            </button>
          </Card>

          {/* Device list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.length === 0 ? (
              <Card className="border-0 shadow p-8 text-center text-sm text-[#8A8A8A] col-span-2">
                No devices registered yet. Add your F22 Pro serial number above.
              </Card>
            ) : devices.map(d => {
              const online = d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < 5 * 60_000;
              return (
                <Card key={d.id} className="border-0 shadow p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-full p-2 ${online ? 'bg-[#DCFCE7]' : 'bg-[#F3F4F6]'}`}>
                        {online
                          ? <Wifi className="size-5 text-[#16A34A]" />
                          : <WifiOff className="size-5 text-[#8A8A8A]" />}
                      </div>
                      <div>
                        <p className="font-bold text-[#172033]">{d.name}</p>
                        <p className="font-mono text-xs text-[#667085]">{d.serial_no}</p>
                        {d.location && <p className="text-xs text-[#8A8A8A]">{d.location}</p>}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${online ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F3F4F6] text-[#8A8A8A]'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                      <p className="text-[11px] text-[#8A8A8A]">Last seen: {timeAgo(d.last_seen)}</p>
                      <button onClick={() => handleToggleDevice(d)}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold ${
                          d.enabled ? 'bg-[#FEF2F2] text-[#DC2626] hover:bg-[#FFE5E5]' : 'bg-[#F0FDF4] text-[#16A34A] hover:bg-[#DCFCE7]'
                        }`}>
                        {d.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Setup instructions */}
          <Card className="border-0 shadow p-5 bg-[#FFFBEB]">
            <h4 className="font-bold text-[#92400E] mb-2">Device Setup Instructions (F22 Pro)</h4>
            <ol className="list-decimal list-inside space-y-1.5 text-sm text-[#78350F]">
              <li>On the F22 Pro: <strong>Menu → Comm → ADMS / Cloud Server</strong></li>
              <li>Set <strong>Server Address</strong> to your domain (e.g. <code className="bg-[#FEF3C7] px-1 rounded">https://yoursite.com</code>)</li>
              <li>The device will automatically call <code className="bg-[#FEF3C7] px-1 rounded">/iclock/cdata</code></li>
              <li>Ensure the device has internet access (Wi-Fi or LAN)</li>
              <li>The device serial number will appear in the list above within minutes of connecting</li>
            </ol>
          </Card>
        </div>
      )}

      {/* ── PIN MAPPING TAB ── */}
      {tab === 'mapping' && (
        <div className="space-y-4">
          {/* Add mapping */}
          <Card className="border-0 shadow p-5">
            <h3 className="mb-1 font-bold text-[#172033]">Link Device PIN to Incubatee</h3>
            <p className="mb-3 text-sm text-[#667085]">
              Each person enrolled on the device gets a PIN. Map that PIN to an incubatee profile so attendance logs show their name.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A4A4A]">Device *</label>
                <select value={mapDeviceSn} onChange={e => setMapDeviceSn(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select device…</option>
                  {devices.map(d => <option key={d.serial_no} value={d.serial_no}>{d.name} ({d.serial_no})</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A4A4A]">Device PIN *</label>
                <input value={mapPin} onChange={e => setMapPin(e.target.value)}
                  placeholder="e.g. 1"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-[#4A4A4A]">Incubatee *</label>
                <select value={mapIncubateeId} onChange={e => setMapIncubateeId(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <option value="">Select incubatee…</option>
                  {incubatees.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.full_name} {i.incubatee_id ? `(${i.incubatee_id})` : ''} — {i.applications?.business_name || i.designation}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={handleAddMapping} disabled={savingMap}
              className="mt-3 flex items-center gap-2 rounded-lg bg-[#172033] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F172A] disabled:opacity-50">
              <Link2 className="size-4" /> {savingMap ? 'Saving…' : 'Save Mapping'}
            </button>
          </Card>

          {/* Mapping list */}
          <Card className="border-0 shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#F8FAFC] text-[#8A8A8A] text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold">Device SN</th>
                    <th className="px-4 py-3 text-left font-bold">PIN</th>
                    <th className="px-4 py-3 text-left font-bold">Incubatee</th>
                    <th className="px-4 py-3 text-left font-bold">Company</th>
                    <th className="px-4 py-3 text-left font-bold">Incubatee ID</th>
                    <th className="px-4 py-3 text-left font-bold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {mappings.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-[#8A8A8A]">No mappings yet.</td></tr>
                  ) : mappings.map(m => (
                    <tr key={m.id} className="hover:bg-[#F8FAFC]">
                      <td className="px-4 py-3 font-mono text-xs">{m.device_sn}</td>
                      <td className="px-4 py-3 font-mono font-bold">{m.pin}</td>
                      <td className="px-4 py-3 font-semibold text-[#172033]">{m.incubatees?.full_name || '—'}</td>
                      <td className="px-4 py-3 text-[#667085]">{m.incubatees?.applications?.business_name || '—'}</td>
                      <td className="px-4 py-3">
                        {m.incubatees?.incubatee_id
                          ? <span className="rounded bg-[#EFF6FF] px-2 py-0.5 font-mono text-xs font-bold text-[#1a73e8]">{m.incubatees.incubatee_id}</span>
                          : <span className="text-[#8A8A8A]">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteMapping(m.id)}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#DC2626] hover:bg-[#FFE5E5]">
                          <Trash2 className="size-3.5" /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </AdminShell>
  );
}
