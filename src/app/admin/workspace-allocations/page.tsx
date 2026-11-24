'use client';

import { FeedbackIcon } from '@/components/icons/feedback';

import { ActionIcon } from '@/components/icons/icon';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Armchair, ArrowRightLeft, Ban, Building2, CircleCheck, Layers2, LockKeyhole,
  PanelsTopLeft, RotateCcw, Search, UsersRound,
} from '@/components/icons/glyphs';
import AdminShell from '@/components/AdminShell';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import {
  getFloorCounts, getUnitStatus, unitById, workspaceFloorIds, workspaceFloors, workspaceStatuses, workspaceUnits,
  type WorkspaceAction, type WorkspaceCompany, type WorkspaceFloor, type WorkspaceSnapshot, type WorkspaceUnit,
} from '@/lib/workspace-floor-plan';
import styles from './workspace.module.css';

const endpoint = '/api/admin/workspace-allocations';
const fieldClass = 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900';
const primaryClass = 'bg-[#C52929] text-white hover:bg-[#A92323]';
const activeControlClass = 'border-slate-800 bg-slate-800 text-white hover:bg-slate-700 hover:text-white';
const panelClass = 'rounded-xl border border-slate-200 bg-white p-4';
const floorIcons = { general: Armchair, mezzanine: Layers2 };
const statusIcons = { available: CircleCheck, allocated: Building2, reserved: LockKeyhole, blocked: Ban, shared: UsersRound };
const modes = [
  { id: 'assign', label: 'Assign', icon: Armchair },
  { id: 'move', label: 'Move', icon: ArrowRightLeft },
  { id: 'reserve', label: 'Reserve', icon: LockKeyhole },
  { id: 'release', label: 'Release', icon: RotateCcw },
] as const;
type Mode = typeof modes[number]['id'];
type Status = keyof typeof workspaceStatuses;
type Data = { snapshot: WorkspaceSnapshot; companies: WorkspaceCompany[]; userEmail: string };
type Marker = {
  id: string;
  displayId: string;
  point: WorkspaceUnit['point'];
  capacity: number;
  status: Status;
  companyId?: string;
  detail?: string;
};

const successMessages = {
  assign: 'Workspace allocation saved.',
  move: 'Allocation moved.',
  reserve: 'Administrative reservation saved.',
  'release-allocation': 'Company allocation released.',
  'release-reservation': 'Administrative reservation released.',
};

const capacityOf = (ids: string[]) => ids.reduce((total, id) => total + (unitById.get(id)?.seats.length ?? 0), 0);
const displayIdFor = (id: string) => unitById.get(id)?.displayId ?? id;
const seatLabel = (count: number) => `${count} ${count === 1 ? 'seat' : 'seats'}`;
const markerPosition = ([x, y]: Marker['point']) => ({ left: `${(x - 174) / 496 * 100}%`, top: `${(y - 120) / 806 * 100}%` });

function StatusBadge({ status, children }: { status: Status; children?: React.ReactNode }) {
  const Icon = statusIcons[status];
  return <span className={`${styles.badge} ${styles[status]} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold`}>
    <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={1.8} />
    {children ?? workspaceStatuses[status]}
  </span>;
}

function getMarkers(units: WorkspaceUnit[], occupancy: WorkspaceSnapshot['occupancy'], bySeat: boolean): Marker[] {
  if (bySeat) return units.flatMap((unit) => unit.seats.map(({ id, point }) => {
    const entry = occupancy[id];
    return {
      id, displayId: displayIdFor(id), point, capacity: 1, status: entry?.status ?? 'available',
      companyId: entry?.status === 'allocated' ? entry.companyId : undefined,
      detail: entry?.status === 'reserved' ? entry.reason : undefined,
    };
  }));

  return units.map((unit) => {
    const entry = getUnitStatus(unit, occupancy);
    const reserved = unit.seats.filter(({ id }) => occupancy[id]?.status === 'reserved');
    return {
      id: unit.id, displayId: unit.displayId, point: unit.point, capacity: unit.seats.length, status: entry.status,
      companyId: entry.status === 'allocated' ? entry.companyId : undefined,
      detail: reserved.length ? `${seatLabel(reserved.length)} reserved` : undefined,
    };
  });
}

export default function WorkspaceAllocationsPage() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [floor, setFloor] = useState<WorkspaceFloor>('general');
  const [mode, setMode] = useState<Mode>('assign');
  const [releaseKind, setReleaseKind] = useState<'allocated' | 'reserved'>('allocated');
  const [selected, setSelected] = useState<string[]>([]);
  const [origin, setOrigin] = useState<string[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [reason, setReason] = useState('');
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (response.status === 401) { router.replace('/admin/login'); return; }
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      setData(payload);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : 'Could not load the floor plan.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  const occupancy = data?.snapshot.occupancy ?? {};
  const companies = data?.companies ?? [];
  const companyNames = new Map(companies.map(({ id, name }) => [id, name]));
  const currentUnits = workspaceUnits.filter((unit) => unit.floor === floor);
  const bySeat = mode === 'reserve' || (mode === 'release' && releaseKind === 'reserved');
  const cubicleView = floor === 'mezzanine' && !bySeat;
  const markers = getMarkers(currentUnits, occupancy, bySeat);
  const choosingOrigin = mode === 'move' && origin.length === 0;
  const sourceUnit = unitById.get((origin.length ? origin : selected)[0]);
  const sourceStatus = sourceUnit && getUnitStatus(sourceUnit, occupancy);
  const sourceCompany = sourceStatus?.status === 'allocated' ? sourceStatus.companyId : '';
  const normalizedQuery = query.trim().toLowerCase();
  const matchingCompanies = normalizedQuery ? companies.filter((company) => company.name.toLowerCase().includes(normalizedQuery)) : [];

  function resetSelection() {
    setSelected([]);
    setOrigin([]);
    setCompanyId('');
    setReason('');
  }

  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    resetSelection();
    setError('');
    setNotice('');
  }

  function isSelectable(marker: Marker) {
    if (saving) return false;
    if (choosingOrigin) return marker.status === 'allocated' && (!sourceCompany || marker.companyId === sourceCompany);
    if (mode === 'release') return marker.status === releaseKind;
    return marker.status === 'available';
  }

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function save(action: WorkspaceAction) {
    if (!data || saving) return;
    setSaving(true);
    setNotice('');
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...action, version: data.snapshot.version }),
      });
      if (response.status === 401) { router.replace('/admin/login'); return; }
      const payload = await response.json();
      if (response.status === 409) {
        resetSelection();
        await load();
      }
      if (!response.ok) throw new Error(payload.error);
      setData({ ...data, snapshot: payload.snapshot });
      resetSelection();
      setNotice(successMessages[action.action]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the workspace change.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await authClient.signOut();
    router.push('/admin/login');
  }

  const instruction = {
    assign: 'Select available chairs or whole cubicles, then choose a company.',
    move: choosingOrigin ? 'Select the occupied spaces to move. All must belong to the same company.' : 'Select the available destination spaces. You can switch floors before confirming.',
    reserve: 'Select available seats and enter the administrative reason. Reserving a seat blocks its entire cubicle from company allocation.',
    release: releaseKind === 'allocated' ? 'Select chairs or whole cubicles to release their company allocations.' : 'Select the seats whose administrative reservations you want to release.',
  }[mode];

  return <AdminShell title="Workspace Allocation" subtitle="Assign General Layout chairs and Mezzanine cubicles to companies." userEmail={data?.userEmail} onLogout={logout}>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800"><FeedbackIcon kind="error" />{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800"><FeedbackIcon kind="success" />{notice}</p>}
    {loading ? <p role="status"><FeedbackIcon kind="loading" />Loading floor plans…</p> : !data ? (
      <Button variant="outline" onClick={() => { setError(''); void load(); }}>Retry</Button>
    ) : <>
      <section aria-label="Floor capacity" className="mb-4 grid gap-3 sm:grid-cols-2">
        {workspaceFloorIds.map((id) => {
          const counts = getFloorCounts(id, occupancy);
          return <div key={id} className={panelClass}>
            <h2 className="mb-3 font-bold">{workspaceFloors[id].label}</h2>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="available">{counts.available} available</StatusBadge>
              <StatusBadge status="allocated">{counts.allocated} allocated</StatusBadge>
              <StatusBadge status="reserved">{counts.reserved} reserved</StatusBadge>
              {counts.blocked > 0 && <StatusBadge status="blocked">{counts.blocked} blocked</StatusBadge>}
            </div>
          </div>;
        })}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(315px,0.8fr)]">
        <section id="workspace-floor-plan" aria-label="Interactive floor plan" className={`${panelClass} order-2 min-w-0 scroll-mt-24 xl:order-none`}>
          <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Select a floor">
            {workspaceFloorIds.map((id) => {
              const Icon = floorIcons[id];
              return <Button key={id} variant="outline" aria-pressed={floor === id}
                className={floor === id ? activeControlClass : ''} onClick={() => setFloor(id)}>
                <Icon aria-hidden="true" strokeWidth={1.8} />{workspaceFloors[id].label}
              </Button>;
            })}
          </div>
          <div className="mb-3 flex flex-wrap gap-2" aria-label="Map legend">
            <StatusBadge status="available" /><StatusBadge status="allocated" />
            <StatusBadge status="reserved" /><StatusBadge status="shared" />
          </div>
          <p className="mb-3 text-sm text-slate-600">{floor === 'general'
            ? 'Workstation chairs are assigned individually. Meeting, reception and service areas are shared.'
            : 'Companies use whole cubicles. The remaining mezzanine areas are shared.'}</p>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50">
            <div className={styles.plan}>
              {/* The plan uses the source drawing dimensions so its markers stay aligned as it scales. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.drawing} src={`${endpoint}/plan/${floor}`} width={827} height={1169} alt={`${workspaceFloors[floor].label} architectural drawing`} />
              {markers.map((marker) => {
                const isSelected = selected.includes(marker.id) || origin.includes(marker.id);
                const detail = (marker.companyId && companyNames.get(marker.companyId)) || marker.detail;
                const label = `${marker.displayId}, ${seatLabel(marker.capacity)}, ${workspaceStatuses[marker.status]}${detail ? `, ${detail}` : ''}`;
                return <button key={marker.id} type="button" title={label} aria-label={label} aria-pressed={isSelected}
                  disabled={!isSelectable(marker)} data-match={Boolean(highlight && marker.companyId === highlight)}
                  className={`${styles.marker} ${styles[marker.status]} ${cubicleView ? styles.cubicle : ''}`}
                  style={markerPosition(marker.point)} onClick={() => toggle(marker.id)}>
                  {cubicleView ? <span className={styles.cubicleLabel}>
                    <PanelsTopLeft aria-hidden="true" className="size-4" strokeWidth={1.8} />
                    {marker.displayId}<small>{seatLabel(marker.capacity)}</small>
                  </span> : marker.displayId.slice(-2)}
                </button>;
              })}
            </div>
          </div>
          <details className="mt-3 rounded-lg border border-slate-200 text-sm">
            <summary className="cursor-pointer p-3 font-bold">{bySeat ? 'Seat list' : 'Workspace list'}</summary>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto border-t border-slate-200 px-3">
              {markers.map((marker) => <li key={marker.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 break-words">
                  <span className="font-bold">{marker.displayId}</span>{' · '}{seatLabel(marker.capacity)}{' · '}{workspaceStatuses[marker.status]}
                  {(marker.companyId || marker.detail) && <p className="text-slate-600">{(marker.companyId && companyNames.get(marker.companyId)) || marker.detail}</p>}
                </div>
                {isSelectable(marker) && <Button variant="outline" aria-label={`${selected.includes(marker.id) ? 'Deselect' : 'Select'} ${marker.displayId}`}
                  aria-pressed={selected.includes(marker.id)} onClick={() => toggle(marker.id)}>{selected.includes(marker.id) ? 'Selected' : 'Select'}</Button>}
              </li>)}
            </ul>
          </details>
        </section>

        <div className="contents xl:sticky xl:top-5 xl:block xl:space-y-4">
          <section aria-label="Manage allocations" className={`${panelClass} order-1`}>
            <h2 className="mb-3 text-lg font-bold">Manage allocations</h2>
            <div role="group" aria-label="Allocation action" className="mb-3 flex flex-wrap gap-2">
              {modes.map(({ id, label, icon: Icon }) => <Button key={id} variant="outline" size="lg" aria-pressed={mode === id} disabled={saving}
                className={mode === id ? activeControlClass : ''} onClick={() => changeMode(id)}>
                <Icon aria-hidden="true" strokeWidth={1.8} />{label}
              </Button>)}
            </div>
            {mode === 'release' && <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Release type">
              {([['allocated', 'Company allocations'], ['reserved', 'Administrative reservations']] as const).map(([id, label]) => (
                <Button key={id} variant={releaseKind === id ? 'secondary' : 'outline'} aria-pressed={releaseKind === id} disabled={saving}
                  onClick={() => { if (id !== releaseKind) { setReleaseKind(id); setSelected([]); } }}>{label}</Button>
              ))}
            </div>}
            <p className="mb-4 text-sm text-slate-600">{instruction}</p>
            <div aria-live="polite" className="mb-4 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              {sourceCompany && mode === 'move' && <p><strong>Company</strong> · {companyNames.get(sourceCompany) ?? sourceCompany}</p>}
              {origin.length > 0 && <p className="break-words"><strong>From</strong> · {origin.map(displayIdFor).join(', ')} · {seatLabel(capacityOf(origin))}</p>}
              <p className="break-words"><strong>{origin.length ? 'To' : 'Selected'}</strong> · {selected.length
                ? `${selected.map(displayIdFor).join(', ')} · ${seatLabel(bySeat ? selected.length : capacityOf(selected))}` : 'Choose spaces on the plan'}</p>
            </div>

            <div className="space-y-3">
              {mode === 'assign' && <>
                <label className="block text-sm font-bold" htmlFor="allocation-company">Company</label>
                <select id="allocation-company" className={fieldClass} value={companyId} onChange={(event) => setCompanyId(event.target.value)} disabled={saving}>
                  <option value="">Choose an approved company</option>
                  {companies.filter(({ eligible }) => eligible).map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                </select>
                <Button className={primaryClass} size="lg" disabled={saving || !selected.length || !companyId}
                  onClick={() => void save({ action: 'assign', unitIds: selected, companyId })}>Assign selected spaces</Button>
              </>}
              {mode === 'move' && (choosingOrigin ? <Button className={primaryClass} size="lg" disabled={saving || !selected.length || !companies.some(({ id, eligible }) => id === sourceCompany && eligible)}
                onClick={() => { setOrigin(selected); setSelected([]); }}>Choose destination</Button> : <div className="flex flex-wrap gap-2">
                <Button className={primaryClass} size="lg" disabled={saving || !selected.length}
                  onClick={() => void save({ action: 'move', fromUnitIds: origin, unitIds: selected })}>Confirm move</Button>
                <Button variant="outline" size="lg" disabled={saving} onClick={() => { setSelected(origin); setOrigin([]); }}>Change original spaces</Button>
              </div>)}
              {choosingOrigin && sourceCompany && !companies.some(({ id, eligible }) => id === sourceCompany && eligible) &&
                <p className="text-sm text-slate-600">This company is no longer approved. Its existing allocation can be released.</p>}
              {mode === 'reserve' && <>
                <label className="block text-sm font-bold" htmlFor="reservation-reason">Reservation reason</label>
                <textarea id="reservation-reason" className={`${fieldClass} h-auto py-2`} rows={3} maxLength={500} value={reason}
                  onChange={(event) => setReason(event.target.value)} disabled={saving} />
                <Button className={primaryClass} size="lg" disabled={saving || !selected.length || !reason.trim()}
                  onClick={() => void save({ action: 'reserve', seatIds: selected, reason })}>Reserve for administrative use</Button>
              </>}
              {mode === 'release' && <Button className={primaryClass} size="lg" disabled={saving || !selected.length}
                onClick={() => void save(releaseKind === 'allocated'
                  ? { action: 'release-allocation', unitIds: selected } : { action: 'release-reservation', seatIds: selected })}>
                {releaseKind === 'allocated' ? 'Release selected allocations' : 'Release selected reservations'}
              </Button>}
              {saving && <p role="status" className="text-sm text-slate-600">Saving changes…</p>}
            </div>
            {(selected.length > 0 || origin.length > 0) && <Button variant="ghost" className="mt-3" disabled={saving} onClick={resetSelection}><ActionIcon name="cancel" />Clear selection</Button>}
          </section>

          <section aria-label="Company workspace search" className={`${panelClass} order-3`}>
            <label htmlFor="workspace-company-search" className="mb-2 flex items-center gap-2 text-lg font-bold">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-50 text-slate-600 ring-1 ring-inset ring-slate-200/75">
                <Search aria-hidden="true" className="size-[17px]" strokeWidth={1.8} />
              </span>
              Find a company
            </label>
            <input id="workspace-company-search" type="search" value={query} placeholder="Search by company name"
              className={fieldClass} onChange={(event) => { setQuery(event.target.value); setHighlight(''); }} />
            {normalizedQuery && <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
              {matchingCompanies.length === 0 && <p className="text-sm text-slate-600">No matching companies.</p>}
              {matchingCompanies.map((company) => {
                const units = workspaceUnits.filter((unit) => {
                  const status = getUnitStatus(unit, occupancy);
                  return status.status === 'allocated' && status.companyId === company.id;
                });
                return <div key={company.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="flex items-center gap-2 font-bold"><Building2 aria-hidden="true" className="size-4 shrink-0 text-slate-600" strokeWidth={1.8} />{company.name}</p>
                  {!units.length && <p className="mt-1 text-slate-600">No allocated workspaces.</p>}
                  {workspaceFloorIds.map((id) => {
                    const floorUnits = units.filter((unit) => unit.floor === id);
                    if (!floorUnits.length) return null;
                    return <button key={id} type="button" aria-pressed={highlight === company.id && floor === id}
                      className="mt-1 block break-words text-left font-semibold text-blue-800 underline underline-offset-2"
                      onClick={() => {
                        setHighlight(company.id);
                        setFloor(id);
                        document.getElementById('workspace-floor-plan')?.scrollIntoView({ block: 'start' });
                      }}>
                      {workspaceFloors[id].label} · {floorUnits.map(({ displayId }) => displayId).join(', ')}
                    </button>;
                  })}
                </div>;
              })}
            </div>}
          </section>
        </div>
      </div>
    </>}
  </AdminShell>;
}
