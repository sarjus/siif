import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import { NextRequest, NextResponse } from 'next/server';
import { getMysqlPool } from '@/lib/mysql';
import { requireAdmin } from '@/lib/server-auth';
import { seatIds, unitById, type WorkspaceAction, type WorkspaceSnapshot } from '@/lib/workspace-floor-plan';

type AssignmentRow = RowDataPacket & {
  seat_id: string | null;
  company_id: string | null;
  reservation_reason: string | null;
};
type CompanyRow = RowDataPacket & { id: string; name: string; status: string };
type VersionRow = RowDataPacket & { version: string };

class WorkspaceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function workspaceError(error: unknown) {
  if (error instanceof WorkspaceError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  switch ((error as { code?: string } | null)?.code) {
    case 'ER_NO_SUCH_TABLE':
      return NextResponse.json({ error: 'Install the workspace allocation database migration to use this page.' }, { status: 503 });
    case 'ER_LOCK_DEADLOCK':
    case 'ER_LOCK_WAIT_TIMEOUT':
      return NextResponse.json({ error: 'Another update interrupted this change. Review the refreshed plan and try again.' }, { status: 409 });
    default:
      console.error('Workspace allocation request failed:', error);
      return NextResponse.json({ error: 'Could not access workspace allocations.' }, { status: 500 });
  }
}

function readOccupancy(rows: AssignmentRow[]): WorkspaceSnapshot['occupancy'] {
  const occupancy: WorkspaceSnapshot['occupancy'] = {};
  for (const row of rows) {
    if (!row.seat_id || !seatIds.has(row.seat_id)) continue;
    occupancy[row.seat_id] = row.company_id
      ? { status: 'allocated', companyId: row.company_id }
      : { status: 'reserved', reason: row.reservation_reason ?? '' };
  }
  return occupancy;
}

export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (response) return response;
    const pool = getMysqlPool();
    const [rows] = await pool.execute<(VersionRow & AssignmentRow)[]>(`
      SELECT revision.version, assignment.seat_id, assignment.company_id, assignment.reservation_reason
      FROM workspace_allocation_revision revision
      LEFT JOIN workspace_seat_assignments assignment ON TRUE
      WHERE revision.id = 1
    `);
    if (!rows.length) throw new WorkspaceError('The workspace allocation migration has not been initialized.', 503);
    const [companies] = await pool.execute<CompanyRow[]>(`
      SELECT application.id, application.status,
        COALESCE(NULLIF(TRIM(application.business_name), ''), NULLIF(TRIM(application.lead_name), ''),
          NULLIF(TRIM(application.email), ''), application.id) AS name
      FROM applications application
      WHERE application.status = 'approved' OR EXISTS (
        SELECT 1 FROM workspace_seat_assignments assignment WHERE assignment.company_id = application.id
          AND assignment.seat_id IN (${Array.from(seatIds, () => '?').join(', ')})
      )
      ORDER BY name, application.id
    `, [...seatIds]);
    return NextResponse.json({
      userEmail: user?.email,
      snapshot: { version: rows[0].version, occupancy: readOccupancy(rows) },
      companies: companies.map(({ id, name, status }) => ({ id, name, eligible: status === 'approved' })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return workspaceError(error);
  }
}

const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);

function parseIds(value: unknown, inventory: ReadonlySet<string> | ReadonlyMap<string, unknown>, label: string): string[] {
  if (!Array.isArray(value) || !value.length || value.length > inventory.size
    || value.some((id) => typeof id !== 'string' || !inventory.has(id)) || new Set(value).size !== value.length) {
    throw new WorkspaceError(`Select valid ${label}.`, 400);
  }
  return value;
}

function parseAction(input: unknown): WorkspaceAction & { version: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new WorkspaceError('Workspace action is required.', 400);
  }
  const body = input as Record<string, unknown>;
  const { action, version } = body;
  if (!isUuid(version)) throw new WorkspaceError('A valid floor plan version is required.', 400);

  switch (action) {
    case 'assign':
      if (!isUuid(body.companyId)) throw new WorkspaceError('Choose a company.', 400);
      return { action, version, companyId: body.companyId, unitIds: parseIds(body.unitIds, unitById, 'workspaces') };
    case 'move':
      return {
        action, version,
        fromUnitIds: parseIds(body.fromUnitIds, unitById, 'original workspaces'),
        unitIds: parseIds(body.unitIds, unitById, 'destination workspaces'),
      };
    case 'release-allocation':
      return { action, version, unitIds: parseIds(body.unitIds, unitById, 'workspaces') };
    case 'reserve': {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (!reason || reason.length > 500) throw new WorkspaceError('Enter a reservation reason of 1–500 characters.', 400);
      return { action, version, reason, seatIds: parseIds(body.seatIds, seatIds, 'seats') };
    }
    case 'release-reservation':
      return { action, version, seatIds: parseIds(body.seatIds, seatIds, 'seats') };
    default:
      throw new WorkspaceError('Unknown workspace action.', 400);
  }
}

function expandUnits(ids: string[]) {
  return ids.flatMap((id) => unitById.get(id)!.seats.map((seat) => seat.id));
}

function planChanges(action: WorkspaceAction, occupancy: WorkspaceSnapshot['occupancy']) {
  const remove = action.action === 'move' ? expandUnits(action.fromUnitIds)
    : action.action === 'release-allocation' ? expandUnits(action.unitIds)
    : action.action === 'release-reservation' ? action.seatIds : [];
  const add = action.action === 'assign' || action.action === 'move' ? expandUnits(action.unitIds)
    : action.action === 'reserve' ? action.seatIds : [];

  if (remove.some((id) => occupancy[id]?.status !== (action.action === 'release-reservation' ? 'reserved' : 'allocated'))) {
    throw new WorkspaceError('The selected allocation or reservation has changed. Review the floor plan and try again.', 409);
  }
  if (add.some((id) => occupancy[id])) {
    throw new WorkspaceError('One or more selected spaces are no longer available.', 409);
  }

  let companyId: string | null = null;
  if (action.action === 'assign') companyId = action.companyId;
  if (action.action === 'move') {
    const original = occupancy[remove[0]];
    if (original?.status !== 'allocated' || remove.some((id) => {
      const seat = occupancy[id];
      return seat?.status !== 'allocated' || seat.companyId !== original.companyId;
    })) {
      throw new WorkspaceError('Choose original workspaces assigned to the same company.', 400);
    }
    companyId = original.companyId;
  }
  return { remove, add, companyId, reason: action.action === 'reserve' ? action.reason : null };
}

export async function PATCH(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;
    const action = parseAction(await request.json().catch(() => null));
    const connection = await getMysqlPool().getConnection();
    try {
      await connection.beginTransaction();
      // Serialize writes even when no workspace has been assigned yet.
      const [revisions] = await connection.execute<VersionRow[]>(
        'SELECT version FROM workspace_allocation_revision WHERE id = 1 FOR UPDATE',
      );
      if (!revisions.length) throw new WorkspaceError('The workspace allocation migration has not been initialized.', 503);
      if (revisions[0].version !== action.version) {
        throw new WorkspaceError('The floor plan changed while you were editing. Review the refreshed plan and try again.', 409);
      }

      const [rows] = await connection.execute<AssignmentRow[]>(
        'SELECT seat_id, company_id, reservation_reason FROM workspace_seat_assignments FOR UPDATE',
      );
      const occupancy = readOccupancy(rows);
      const { remove, add, companyId, reason } = planChanges(action, occupancy);
      if (companyId) {
        const [companies] = await connection.execute<RowDataPacket[]>(
          "SELECT id FROM applications WHERE id = ? AND status = 'approved' FOR UPDATE", [companyId],
        );
        if (!companies.length) throw new WorkspaceError('This company is no longer approved for workspace allocation.', 409);
      }

      if (remove.length) {
        await connection.execute(`DELETE FROM workspace_seat_assignments WHERE seat_id IN (${remove.map(() => '?').join(', ')})`, remove);
        remove.forEach((id) => { delete occupancy[id]; });
      }
      if (add.length) {
        await connection.execute(
          `INSERT INTO workspace_seat_assignments (seat_id, company_id, reservation_reason) VALUES ${add.map(() => '(?, ?, ?)').join(', ')}`,
          add.flatMap((id) => [id, companyId, reason]),
        );
        add.forEach((id) => {
          occupancy[id] = companyId ? { status: 'allocated', companyId } : { status: 'reserved', reason: reason! };
        });
      }
      const version = randomUUID();
      await connection.execute('UPDATE workspace_allocation_revision SET version = ? WHERE id = 1', [version]);
      await connection.commit();
      return NextResponse.json({ snapshot: { version, occupancy } });
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    return workspaceError(error);
  }
}
