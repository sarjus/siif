/**
 * ADMS / iClock Push Protocol receiver
 * ------------------------------------
 * The eSSL F22 Pro (and all ZKTeco-compatible devices) push data here.
 *
 * GET  /iclock/cdata?SN=<serial>&options=...
 *   — Device handshake / heartbeat. We reply with current server time
 *     so the device can sync its clock.
 *
 * POST /iclock/cdata?SN=<serial>&table=ATTLOG&Stamp=<ts>
 *   — Device pushes attendance punches as plain text, one record per line:
 *     PIN  YYYY-MM-DD HH:MM:SS  VerifyType  PunchType  [WorkCode]
 *     e.g. "1 2026-06-22 09:05:11 1 0"
 *
 * Device setup (Menu → Comm → ADMS / Cloud Server):
 *   Server:  https://yoursite.com
 *   (the device automatically appends /iclock/cdata)
 *
 * NOTE: This route intentionally uses NO auth headers.
 * The device cannot send Bearer tokens. We rely on:
 *   1. A shared secret query-param or header (ADMS_SECRET env var) — optional
 *   2. Device serial number registration in the attendance_devices table
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/server-auth';

// Optional shared secret — set ADMS_SECRET in .env.local and on the device
const ADMS_SECRET = process.env.ADMS_SECRET || '';

/** Format current time as YYYY-MM-DD HH:MM:SS in IST for the device */
function serverTimeString(): string {
  // Device expects local time (IST = UTC+5:30)
  const now = new Date();
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('T', ' ').substring(0, 19);
}

/** Parse a single ATTLOG line into structured fields */
function parseAttlogLine(line: string): {
  pin: string;
  punchTime: Date;
  verifyType: number;
  punchType: number;
  workCode: string;
  raw: string;
} | null {
  // Format: "PIN YYYY-MM-DD HH:MM:SS VerifyType PunchType [WorkCode]"
  const parts = line.trim().split(/\s+/);
  if (parts.length < 5) return null;

  const [pin, date, time, verifyStr, punchStr, ...rest] = parts;
  if (!pin || !date || !time) return null;

  const punchTime = new Date(`${date}T${time}+05:30`); // device is in IST (UTC+5:30)
  if (isNaN(punchTime.getTime())) return null;

  return {
    pin,
    punchTime,
    verifyType: parseInt(verifyStr, 10) || 0,
    punchType: parseInt(punchStr, 10) || 0,
    workCode: rest.join(' '),
    raw: line.trim(),
  };
}

// ─── GET: handshake & heartbeat ───────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN') || '';

  // Optional secret check
  if (ADMS_SECRET) {
    const provided = searchParams.get('secret') || request.headers.get('x-adms-secret') || '';
    if (provided !== ADMS_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  if (!sn) {
    return new NextResponse('ERROR: Missing SN', { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Upsert device — auto-register on first contact
  await supabase
    .from('attendance_devices')
    .upsert({ serial_no: sn, last_seen: new Date().toISOString() }, { onConflict: 'serial_no' })
    .select()
    .maybeSingle();

  // Standard iClock handshake response
  // Format must be exactly: "GET STAMP\r\nDate:YYYY-MM-DD HH:MM:SS\r\n\r\n"
  const body = `GET STAMP\r\nDate:${serverTimeString()}\r\n\r\n`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
      'Connection': 'close',
    },
  });
}

// ─── POST: receive attendance records ─────────────────────────────────────────
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sn = searchParams.get('SN') || '';
  const table = searchParams.get('table') || '';

  // Optional secret check
  if (ADMS_SECRET) {
    const provided = searchParams.get('secret') || request.headers.get('x-adms-secret') || '';
    if (provided !== ADMS_SECRET) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }

  if (!sn) return new NextResponse('ERROR: Missing SN', { status: 400 });

  const supabase = createServiceRoleClient();

  // Update device heartbeat
  await supabase
    .from('attendance_devices')
    .upsert({ serial_no: sn, last_seen: new Date().toISOString() }, { onConflict: 'serial_no' })
    .select()
    .maybeSingle();

  // We only process attendance logs
  if (table !== 'ATTLOG') {
    // For other tables (OPERLOG, user data, etc.) just acknowledge
    return new NextResponse('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // Get the device UUID for FK
  const { data: device } = await supabase
    .from('attendance_devices')
    .select('id, enabled')
    .eq('serial_no', sn)
    .maybeSingle();

  if (device && !device.enabled) {
    return new NextResponse('ERROR: Device disabled', { status: 403 });
  }

  // Parse body — device sends as plain text (not always form-encoded despite Content-Type)
  let bodyText = '';
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = await request.formData().catch(() => null);
    bodyText = form ? (form.get('table') as string | null) || '' : '';
    if (!bodyText) {
      // Some firmware sends the lines as form value under key matching table name
      const raw = await request.text().catch(() => '');
      const params = new URLSearchParams(raw);
      bodyText = params.get('ATTLOG') || params.get('table') || raw;
    }
  } else {
    bodyText = await request.text().catch(() => '');
  }

  if (!bodyText.trim()) {
    return new NextResponse('OK: 0', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  // Parse and insert each attendance line
  const lines = bodyText.split('\n').filter((l) => l.trim());
  let saved = 0;
  let skipped = 0;

  for (const line of lines) {
    const parsed = parseAttlogLine(line);
    if (!parsed) { skipped++; continue; }

    // Look up user mapping to link to an incubatee
    const { data: mapping } = await supabase
      .from('attendance_user_mapping')
      .select('incubatee_id')
      .eq('device_sn', sn)
      .eq('pin', parsed.pin)
      .maybeSingle();

    const { error } = await supabase
      .from('attendance_logs')
      .insert({
        device_id: device?.id || null,
        device_sn: sn,
        pin: parsed.pin,
        punch_time: parsed.punchTime.toISOString(),
        punch_type: parsed.punchType,
        verify_type: parsed.verifyType,
        work_code: parsed.workCode || null,
        raw_line: parsed.raw,
        incubatee_id: mapping?.incubatee_id || null,
      });

    // Conflict = duplicate punch, count as skipped
    if (!error) {
      saved++;
    } else if (error.code === '23505') {
      skipped++; // unique constraint violation — already stored
    } else {
      console.error('[ADMS] Insert error:', error.message, 'line:', line);
      skipped++;
    }
  }

  // Standard iClock acknowledgement
  return new NextResponse(`OK: ${saved}`, {
    status: 200,
    headers: { 'Content-Type': 'text/plain', 'Connection': 'close' },
  });
}
