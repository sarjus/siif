'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Clock3 } from '@/components/icons/glyphs';
import { NavigationIcon } from '@/components/icons/icon';
import { Button } from '@/components/ui/button';

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

const bookingStyles: Record<Booking['status'], string> = {
  approved: 'border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100',
  pending: 'border-amber-400 border-dashed bg-amber-50 text-amber-950 hover:bg-amber-100',
  rejected: 'border-red-300 bg-red-50 text-red-900',
  cancelled: 'border-slate-300 bg-slate-50 text-slate-700',
};

const dateLabel = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' });
const todayStyle = 'bg-[#C52936] text-white';
const calendarViews = [{ id: 'week', label: 'Week', icon: CalendarClock }, { id: 'month', label: 'Month', icon: CalendarDays }] as const;

function CalendarNavigation({ previous, next, unit }: { previous: () => void; next: () => void; unit: string }) {
  return <div className="flex gap-1">
    <Button type="button" size="icon-lg" variant="ghost" aria-label={`Previous ${unit}`} title={`Previous ${unit}`} onClick={previous}>
      <NavigationIcon icon={ChevronLeft} className="size-5" />
    </Button>
    <Button type="button" size="icon-lg" variant="ghost" aria-label={`Next ${unit}`} title={`Next ${unit}`} onClick={next}>
      <NavigationIcon icon={ChevronRight} className="size-5" />
    </Button>
  </div>;
}

function BookingLegend() {
  return <div className="flex flex-wrap items-center gap-2" aria-label="Booking status legend">
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900">
      <CircleCheck aria-hidden="true" className="size-3.5" /> Approved
    </span>
    <span className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-amber-400 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-950">
      <Clock3 aria-hidden="true" className="size-3.5" /> Pending
    </span>
  </div>;
}

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
  const offset = ((startTotalMins - FIRST_HOUR * 60) / 60) * HOUR_H;
  const endOffset = offset + (durationMins / 60) * HOUR_H;
  if (endOffset <= 0 || offset >= TOTAL_H) return null;
  const top = Math.max(offset, 0);
  const height = Math.min(Math.max(endOffset - top - 2, 22), TOTAL_H - top);
  const company = b.applications?.business_name;
  const timeLabel = localTime(start);
  const bodyLabel = b.status === 'approved' && company
    ? `${b.title} · ${company}`
    : b.title;

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={`${bodyLabel} · ${timeLabel}–${localTime(end)} · ${b.status}`}
      aria-label={`${bodyLabel}, ${timeLabel} to ${localTime(end)}, ${b.status}`}
      className={`absolute inset-x-1 z-10 flex cursor-pointer flex-col items-start overflow-hidden rounded-lg border px-2 py-0.5 text-left text-xs leading-tight shadow-sm focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-slate-800 ${bookingStyles[b.status]}`}
      style={{ top, height }}
    >
      <span className="max-w-full truncate font-bold">{timeLabel}–{localTime(end)}</span>
      <span className="max-w-full truncate font-medium">{bodyLabel}</span>
    </button>
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
  const weekScroll = useRef<HTMLDivElement>(null);

  const weekStart = useMemo(() => sundayWeekStart(anchor), [anchor]);
  const weekDays  = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const mGrid     = useMemo(() => monthGrid(anchor.getFullYear(), anchor.getMonth()), [anchor]);
  const mini      = useMemo(() => miniGrid(miniMon.y, miniMon.m), [miniMon]);

  useEffect(() => {
    const container = weekScroll.current;
    const selectedDay = container?.querySelector('[data-anchor-day]');
    const timeColumn = container?.querySelector('[data-time-column]');
    if (!container || !selectedDay || !timeColumn) return;

    const day = selectedDay.getBoundingClientRect();
    const left = container.getBoundingClientRect().left;
    const visibleStart = left + timeColumn.getBoundingClientRect().width;
    const visibleEnd = left + container.clientWidth;
    if (day.left < visibleStart) container.scrollLeft += day.left - visibleStart;
    else if (day.right > visibleEnd) container.scrollLeft += day.right - visibleEnd;
  }, [anchor, view]);

  const selectDate = (date: Date) => {
    setAnchor(new Date(date));
    setMiniMon({ y: date.getFullYear(), m: date.getMonth() });
  };

  const nav = (dir: -1 | 1) => selectDate(view === 'week'
    ? addDays(anchor, dir * 7)
    : new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1));

  const navigateMiniMonth = (dir: -1 | 1) => setMiniMon(({ y, m }) => {
    const date = new Date(y, m + dir, 1);
    return { y: date.getFullYear(), m: date.getMonth() };
  });

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
    <div className="flex h-full overflow-hidden bg-white text-slate-900">
      <aside aria-label="Mini calendar" className="hidden w-52 shrink-0 flex-col border-r border-slate-200 bg-slate-50/75 p-3 xl:flex">
        <div className="mb-2 flex items-center justify-between gap-1">
          <span className="text-sm font-bold text-slate-800">{MONTH_NAMES[miniMon.m]} {miniMon.y}</span>
          <CalendarNavigation unit="mini calendar month" previous={() => navigateMiniMonth(-1)} next={() => navigateMiniMonth(1)} />
        </div>
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-500">
          {DAY_LABELS.map((day) => <span key={day} className="py-1">{day[0]}</span>)}
        </div>
        <div className="grid grid-cols-7 text-center">
          {mini.map((day, index) => {
            if (!day) return <span key={index} />;
            const selected = sameDay(day, anchor);
            const current = sameDay(day, today);
            return (
              <button key={index} type="button" onClick={() => selectDate(day)}
                aria-label={dateLabel.format(day)} aria-current={current ? 'date' : undefined} aria-pressed={selected}
                className={'mx-auto my-0.5 grid size-6 place-items-center rounded-lg text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-slate-800 ' +
                  (current ? todayStyle : selected ? 'bg-rose-100 text-rose-900' : 'text-slate-700 hover:bg-slate-200')}>
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 space-y-3 border-b border-slate-200 px-3 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 aria-live="polite" className="text-base font-bold text-slate-900 sm:text-lg">{periodLabel}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="lg" onClick={() => selectDate(today)}>Today</Button>
              <CalendarNavigation unit={view} previous={() => nav(-1)} next={() => nav(1)} />
              <div role="group" aria-label="Calendar view" className="flex gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {calendarViews.map(({ id, label, icon: Icon }) => (
                  <Button key={id} type="button" variant="ghost" aria-pressed={view === id} onClick={() => setView(id)}
                    className={view === id ? 'bg-rose-100 text-rose-900 hover:bg-rose-100 hover:text-rose-900' : 'text-slate-600'}>
                    <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />{label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <BookingLegend />
            {canRequest && <p className="text-xs font-medium text-slate-600">
              {view === 'week' ? 'Select a time slot to request a booking.' : 'Select a date to request a booking.'}
            </p>}
          </div>
        </div>

        {view === 'week' && (
          <div ref={weekScroll} className="min-h-0 flex-1 overflow-auto" aria-label="Weekly calendar">
            <div className="grid min-w-[43rem] grid-cols-[3.5rem_repeat(7,minmax(5.5rem,1fr))]">
              <div data-time-column className="sticky top-0 left-0 z-40 grid h-16 place-items-center border-r border-b border-slate-200 bg-slate-50" aria-hidden="true">
                <Clock3 className="size-4 text-slate-500" />
              </div>
              {weekDays.map((day) => {
                const current = sameDay(day, today);
                return (
                  <div key={day.toISOString()} data-anchor-day={sameDay(day, anchor) ? '' : undefined} aria-current={current ? 'date' : undefined}
                    className="sticky top-0 z-30 flex h-16 flex-col items-center justify-center gap-0.5 border-r border-b border-slate-200 bg-slate-50">
                    <span className="text-xs font-semibold text-slate-600">{DAY_LABELS[day.getDay()]}</span>
                    <span className={'grid size-8 place-items-center rounded-lg text-base font-bold ' + (current ? todayStyle : 'text-slate-900')}>{day.getDate()}</span>
                  </div>
                );
              })}
              <div className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50" aria-hidden="true">
                {HOURS.map((hour) => (
                  <div key={hour} className="border-b border-slate-200 px-1.5 pt-1.5 text-right text-[11px] font-semibold text-slate-600" style={{ height: HOUR_H }}>
                    {fmt12(hour)}
                  </div>
                ))}
              </div>
              {weekDays.map((day) => {
                const current = sameDay(day, today);
                const requestable = canRequest && Boolean(onSlotClick) && !isPast(day);
                return (
                  <div key={day.toISOString()} className={'relative border-r border-slate-200 ' + (current ? 'bg-rose-50/35' : 'bg-white')} style={{ height: TOTAL_H }}>
                    {HOURS.map((hour) => (
                      <div key={hour} className="relative border-b border-slate-200" style={{ height: HOUR_H }}>
                        <div className="pointer-events-none absolute inset-x-0 top-1/2 border-b border-dashed border-slate-100" />
                        {requestable && (
                          <button type="button" aria-label={'Request booking on ' + dateLabel.format(day) + ' at ' + fmt12(hour)}
                            className="absolute inset-0 w-full cursor-pointer hover:bg-rose-100/65 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-inset"
                            onClick={() => handleSlot(day, hour)} />
                        )}
                      </div>
                    ))}
                    {dayBkgs(day).map(booking => (
                      <EventTile key={booking.id} b={booking} onClick={() => onBookingClick?.(booking)} />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === 'month' && (
          <div className="min-h-0 flex-1 overflow-auto" aria-label="Monthly calendar">
            <div className="grid min-w-[38rem] grid-cols-7">
              {DAY_LABELS.map(day => (
                <div key={day} className="sticky top-0 z-20 border-r border-b border-slate-200 bg-slate-50 py-2.5 text-center text-xs font-semibold text-slate-600">{day}</div>
              ))}
              {mGrid.map(day => {
                const current = sameDay(day, today);
                const inMonth = day.getMonth() === anchor.getMonth();
                const requestable = canRequest && Boolean(onSlotClick) && inMonth && !isPast(day);
                const dayBookings = dayBkgs(day);
                return (
                  <div key={day.toISOString()} aria-current={current ? 'date' : undefined}
                    className={'relative min-h-24 min-w-0 border-r border-b border-slate-200 p-1.5 ' +
                      (!inMonth ? 'bg-slate-50' : current ? 'bg-rose-50/35' : 'bg-white')}>
                    {requestable && (
                      <button type="button" aria-label={'Request booking on ' + dateLabel.format(day)}
                        className="absolute inset-0 w-full cursor-pointer hover:bg-rose-100/55 focus-visible:ring-2 focus-visible:ring-rose-600 focus-visible:ring-inset"
                        onClick={() => handleSlot(day, 9)} />
                    )}
                    <span className={'pointer-events-none relative mb-1 grid size-7 place-items-center rounded-lg text-xs font-bold ' +
                      (current ? todayStyle : inMonth ? 'text-slate-800' : 'text-slate-500')}>{day.getDate()}</span>
                    <div className="pointer-events-none relative space-y-1">
                      {dayBookings.slice(0, 4).map(booking => {
                        const company = booking.applications?.business_name;
                        const label = localTime(new Date(booking.start_time)) + ' ' + booking.title +
                          (booking.status === 'approved' && company ? ' · ' + company : '');
                        const description = label + ', ' + booking.status;
                        return (
                          <button key={booking.id} type="button" onClick={() => onBookingClick?.(booking)}
                            title={description} aria-label={description}
                            className={'pointer-events-auto block w-full truncate rounded-md border px-1.5 py-1 text-left text-xs font-semibold focus-visible:outline-2 focus-visible:outline-slate-800 ' + bookingStyles[booking.status]}>
                            {label}
                          </button>
                        );
                      })}
                      {dayBookings.length > 4 && (
                        <button type="button" aria-label={'Show all bookings for ' + dateLabel.format(day)}
                          className="pointer-events-auto rounded px-1.5 py-0.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-slate-800"
                          onClick={() => { selectDate(day); setView('week'); }}>
                          +{dayBookings.length - 4} more
                        </button>
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
