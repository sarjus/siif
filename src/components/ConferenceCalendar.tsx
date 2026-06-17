'use client';

/**
 * ConferenceCalendar — Google Calendar-style UI
 * Fixes:
 *  - Times always shown in LOCAL time (getHours/getMinutes, never raw UTC string)
 *  - Event positions use index-based offset so grid lines align perfectly
 *  - Approved events show "Title · Company"
 *  - Pending events show with dashed border
 */

import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export type Booking = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  company_id: string;
  applications?: { business_name: string | null; email: string } | null;
  requested_by?: string | null;
  rejection_reason?: string | null;
};

type Props = {
  bookings: Booking[];
  onSlotClick?: (date: Date, hour: number) => void;
  onBookingClick?: (booking: Booking) => void;
  canRequest?: boolean;
};

// ── Constants ──────────────────────────────────────────────────────────────
const FIRST_HOUR  = 7;   // 07:00
const LAST_HOUR   = 22;  // 22:00 (exclusive)
const HOURS       = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
const HOUR_H      = 56;  // px per hour row
const TOTAL_H     = HOURS.length * HOUR_H;

const DAY_LABELS  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

const COLORS: Record<string, { bg: string; border: string; text: string }> = {
  approved: { bg: '#1a73e8', border: '#1558b0', text: '#fff' },
  pending:  { bg: '#f9ab00', border: '#b06000', text: '#fff' },
  rejected: { bg: '#d93025', border: '#a50e0e', text: '#fff' },
  cancelled:{ bg: '#e0e0e0', border: '#bdbdbd', text: '#5f6368' },
};

// ── Pure helpers ───────────────────────────────────────────────────────────
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function sundayWeekStart(anchor: Date) {
  const d = new Date(anchor);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Format a Date as HH:MM using LOCAL time */
function localTime(dt: Date) {
  return `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
}

function fmt12(h: number) {
  if (h === 0)  return '12 AM';
  if (h < 12)  return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const pad   = first.getDay(); // Sun=0
  const days: Date[] = [];
  for (let i = -pad; i < new Date(year, month + 1, 0).getDate(); i++) {
    days.push(new Date(year, month, i + 1));
  }
  while (days.length % 7 !== 0) {
    const prev = days[days.length - 1];
    days.push(addDays(prev, 1));
  }
  return days;
}

function miniGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const pad   = first.getDay();
  const last  = new Date(year, month + 1, 0).getDate();
  const out: (Date | null)[] = Array(pad).fill(null);
  for (let i = 1; i <= last; i++) out.push(new Date(year, month, i));
  while (out.length % 7 !== 0) out.push(null);
  return out;
}

// ── EventTile ──────────────────────────────────────────────────────────────
function EventTile({ b, onClick }: { b: Booking; onClick: () => void }) {
  const start  = new Date(b.start_time);
  const end    = new Date(b.end_time);

  // All positioning in LOCAL time — never use raw string or UTC methods
  const sH = start.getHours();
  const sM = start.getMinutes();
  const eH = end.getHours();
  const eM = end.getMinutes();

  const startTotalMins = sH * 60 + sM;
  const endTotalMins   = eH * 60 + eM;
  const durationMins   = endTotalMins > startTotalMins
    ? endTotalMins - startTotalMins
    : endTotalMins + 1440 - startTotalMins; // midnight wrap

  // Index-based: position relative to FIRST_HOUR
  const topPx    = ((startTotalMins - FIRST_HOUR * 60) / 60) * HOUR_H;
  const heightPx = Math.max((durationMins / 60) * HOUR_H - 2, 22);

  if (topPx + heightPx < 0 || topPx > TOTAL_H) return null; // out of visible range

  const c = COLORS[b.status] ?? COLORS.approved;
  const company = b.applications?.business_name;
  const timeLabel = localTime(start);
  const bodyLabel = b.status === 'approved' && company
    ? `${b.title} · ${company}`
    : b.title;

  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${bodyLabel}  ${timeLabel} – ${localTime(end)}`}
      className="absolute left-0.5 right-0.5 z-10 cursor-pointer overflow-hidden rounded px-1.5 py-0.5 select-none"
      style={{
        top: `${Math.max(topPx, 0)}px`,
        height: `${heightPx}px`,
        backgroundColor: c.bg,
        border: b.status === 'pending' ? `2px dashed ${c.border}` : `1px solid ${c.border}`,
        color: c.text,
        fontSize: '11px',
        lineHeight: '1.3',
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
      }}
    >
      <div className="font-bold truncate">{timeLabel}</div>
      <div className="truncate opacity-90">{bodyLabel}</div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ConferenceCalendar({
  bookings, onSlotClick, onBookingClick, canRequest = false,
}: Props) {
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const [view, setView]     = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(new Date(today));
  const [miniMon, setMiniMon] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const weekStart = useMemo(() => sundayWeekStart(anchor), [anchor]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const mGrid     = useMemo(() => monthGrid(anchor.getFullYear(), anchor.getMonth()), [anchor]);
  const mini      = useMemo(() => miniGrid(miniMon.y, miniMon.m), [miniMon]);

  const nav = (dir: -1 | 1) => {
    if (view === 'week') setAnchor(addDays(anchor, dir * 7));
    else setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));
  };
  const goToday = () => {
    setAnchor(new Date(today));
    setMiniMon({ y: today.getFullYear(), m: today.getMonth() });
  };

  const periodLabel = view === 'week'
    ? (() => {
        const s = weekDays[0], e = weekDays[6];
        return s.getMonth() === e.getMonth()
          ? `${s.getDate()} – ${e.getDate()} ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`
          : `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`;
      })()
    : `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;

  // Bookings visible on a day (local date comparison)
  const dayBkgs = (day: Date) =>
    bookings.filter(b => {
      const s = new Date(b.start_time);
      return sameDay(s, day) && b.status !== 'cancelled' && b.status !== 'rejected';
    });

  const isPast = (day: Date) => day < today && !sameDay(day, today);

  const handleSlot = (day: Date, hour: number) => {
    if (!canRequest || !onSlotClick || isPast(day)) return;
    onSlotClick(day, hour);
  };

  return (
    <div className="flex h-full bg-white overflow-hidden" style={{ fontFamily: 'Google Sans, Roboto, Arial, sans-serif' }}>

      {/* ── LEFT SIDEBAR ── */}
      <div className="hidden md:flex w-52 shrink-0 flex-col border-r border-[#dadce0] pt-3 pb-4 px-2">
        {/* Mini calendar */}
        <div className="mb-1 flex items-center justify-between px-1">
          <span className="text-sm font-semibold text-[#3c4043]">
            {MONTH_NAMES[miniMon.m]} {miniMon.y}
          </span>
          <div className="flex">
            <button onClick={() => setMiniMon(p => { const d = new Date(p.y, p.m - 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })}
              className="p-1 rounded-full hover:bg-[#f1f3f4]"><ChevronLeft className="size-3.5 text-[#5f6368]" /></button>
            <button onClick={() => setMiniMon(p => { const d = new Date(p.y, p.m + 1, 1); return { y: d.getFullYear(), m: d.getMonth() }; })}
              className="p-1 rounded-full hover:bg-[#f1f3f4]"><ChevronRight className="size-3.5 text-[#5f6368]" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center mb-0.5">
          {['S','M','T','W','T','F','S'].map((d, i) => (
            <span key={i} className="text-[10px] font-medium text-[#70757a] py-0.5">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 text-center">
          {mini.map((d, i) => {
            if (!d) return <span key={i} />;
            const isT   = sameDay(d, today);
            const isSel = sameDay(d, anchor);
            return (
              <button key={i}
                onClick={() => { setAnchor(new Date(d)); setMiniMon({ y: d.getFullYear(), m: d.getMonth() }); }}
                className={`mx-auto my-0.5 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition-colors
                  ${isT ? 'bg-[#1a73e8] text-white' : isSel ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-[#3c4043] hover:bg-[#f1f3f4]'}
                  ${d.getMonth() !== miniMon.m ? 'opacity-30' : ''}`}>
                {d.getDate()}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-5 space-y-2 px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5f6368]">Legend</p>
          {(['approved','pending'] as const).map(s => (
            <div key={s} className="flex items-center gap-2 text-xs text-[#3c4043]">
              <span className="h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: COLORS[s].bg,
                         border: s === 'pending' ? `2px dashed ${COLORS[s].border}` : 'none' }} />
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}
          {canRequest && (
            <p className="mt-2 text-[11px] leading-relaxed text-[#5f6368]">
              Click an empty slot to request a booking
            </p>
          )}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#dadce0] px-4 py-2">
          <div className="flex items-center gap-1.5">
            <button onClick={goToday}
              className="rounded border border-[#dadce0] px-3 py-1.5 text-sm font-medium text-[#3c4043] hover:bg-[#f1f3f4]">
              Today
            </button>
            <button onClick={() => nav(-1)} className="rounded-full p-1.5 hover:bg-[#f1f3f4]">
              <ChevronLeft className="size-4 text-[#5f6368]" />
            </button>
            <button onClick={() => nav(1)} className="rounded-full p-1.5 hover:bg-[#f1f3f4]">
              <ChevronRight className="size-4 text-[#5f6368]" />
            </button>
            <h2 className="ml-1 text-base font-medium text-[#3c4043]">{periodLabel}</h2>
          </div>
          <div className="flex overflow-hidden rounded border border-[#dadce0] text-sm">
            {(['week','month'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-4 py-1.5 font-medium capitalize transition-colors
                  ${view === v ? 'bg-[#e8f0fe] text-[#1a73e8]' : 'text-[#3c4043] hover:bg-[#f1f3f4]'}`}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* ── WEEK VIEW ── */}
        {view === 'week' && (
          <div className="flex flex-1 overflow-auto">
            {/* Time gutter */}
            <div className="w-14 shrink-0 border-r border-[#dadce0] bg-white">
              <div className="h-14 border-b border-[#dadce0]" /> {/* spacer aligns with day headers */}
              {HOURS.map((h) => (
                <div key={h} className="relative" style={{ height: HOUR_H }}>
                  {/* Label sits ON the grid line — use -translate-y-1/2 */}
                  <span className="absolute top-0 right-2 -translate-y-1/2 bg-white px-0.5 text-[10px] leading-none text-[#70757a]">
                    {fmt12(h)}
                  </span>
                </div>
              ))}
            </div>

            {/* Day columns */}
            <div className="flex min-w-0 flex-1 overflow-x-auto">
              {weekDays.map((day) => {
                const isT  = sameDay(day, today);
                const past = isPast(day);
                const bkgs = dayBkgs(day);
                return (
                  <div key={day.toISOString()}
                    className="flex min-w-[90px] flex-1 flex-col border-r border-[#dadce0] last:border-r-0">
                    {/* Day header */}
                    <div className="flex h-14 flex-col items-center justify-center border-b border-[#dadce0]">
                      <span className={`text-[11px] font-medium uppercase ${isT ? 'text-[#1a73e8]' : 'text-[#70757a]'}`}>
                        {DAY_LABELS[day.getDay()]}
                      </span>
                      <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xl font-semibold
                        ${isT ? 'bg-[#1a73e8] text-white' : 'text-[#3c4043]'}`}>
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Slots — RELATIVE container so EventTile absolutes correctly */}
                    <div className="relative" style={{ height: TOTAL_H }}>
                      {/* Hour rows (clickable) */}
                      {HOURS.map((h, idx) => (
                        <div key={h}
                          className={`absolute left-0 right-0 border-b border-[#e0e0e0]
                            ${canRequest && !past ? 'cursor-pointer hover:bg-[#f0f4ff]' : ''}`}
                          style={{ top: idx * HOUR_H, height: HOUR_H }}
                          onClick={() => handleSlot(day, h)}
                        />
                      ))}
                      {/* Half-hour hairlines */}
                      {HOURS.map((_, idx) => (
                        <div key={`hf-${idx}`}
                          className="pointer-events-none absolute left-0 right-0"
                          style={{ top: idx * HOUR_H + HOUR_H / 2, borderBottom: '1px dashed #f1f3f4' }}
                        />
                      ))}
                      {/* Events */}
                      {bkgs.map(b => (
                        <EventTile key={b.id} b={b} onClick={() => onBookingClick?.(b)} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── MONTH VIEW ── */}
        {view === 'month' && (
          <div className="flex flex-1 flex-col overflow-auto">
            {/* Day name row */}
            <div className="grid shrink-0 grid-cols-7 border-b border-[#dadce0]">
              {DAY_LABELS.map(d => (
                <div key={d} className="border-r border-[#dadce0] py-2 text-center text-[11px] font-medium uppercase text-[#70757a] last:border-r-0">
                  {d}
                </div>
              ))}
            </div>
            {/* Grid */}
            <div className="grid flex-1 grid-cols-7">
              {mGrid.map((day, idx) => {
                const isT    = sameDay(day, today);
                const inMon  = day.getMonth() === anchor.getMonth();
                const past   = isPast(day);
                const bkgs   = dayBkgs(day);
                return (
                  <div key={idx}
                    className={`flex min-h-[96px] flex-col border-b border-r border-[#dadce0] p-1 last:border-r-0
                      ${!inMon ? 'bg-[#f8f9fa]' : 'bg-white'}
                      ${canRequest && !past && inMon ? 'cursor-pointer hover:bg-[#f8f9fa]' : ''}`}
                    onClick={() => { if (canRequest && !past && inMon) handleSlot(day, 9); }}>
                    {/* Date number */}
                    <div className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full self-start
                      text-xs font-semibold
                      ${isT ? 'bg-[#1a73e8] text-white' : inMon ? 'text-[#3c4043]' : 'text-[#bdc1c6]'}`}>
                      {day.getDate()}
                    </div>
                    {/* Event pills */}
                    <div className="flex-1 space-y-0.5 overflow-hidden">
                      {bkgs.slice(0, 4).map(b => {
                        const c = COLORS[b.status] ?? COLORS.approved;
                        const company = b.applications?.business_name;
                        const label = b.status === 'approved' && company
                          ? `${localTime(new Date(b.start_time))} ${b.title} · ${company}`
                          : `${localTime(new Date(b.start_time))} ${b.title}`;
                        return (
                          <div key={b.id}
                            onClick={e => { e.stopPropagation(); onBookingClick?.(b); }}
                            title={label}
                            className="cursor-pointer truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
                            style={{
                              backgroundColor: c.bg,
                              color: c.text,
                              border: b.status === 'pending' ? `1px dashed ${c.border}` : 'none',
                            }}>
                            {label}
                          </div>
                        );
                      })}
                      {bkgs.length > 4 && (
                        <div className="px-1 text-[11px] font-medium text-[#1a73e8]">
                          +{bkgs.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
