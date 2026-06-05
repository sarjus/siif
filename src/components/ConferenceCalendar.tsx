'use client';

/**
 * ConferenceCalendar — weekly and monthly view, no external calendar library needed.
 * Shows approved bookings in solid color, pending in dashed border.
 * Clicking an empty slot calls onSlotClick(date, hour) for booking requests.
 */

import { useMemo, useState } from 'react';

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

const STATUS_COLORS: Record<string, string> = {
  approved: '#16A34A',
  pending: '#F59E0B',
  rejected: '#DC2626',
  cancelled: '#9CA3AF',
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 08:00 – 21:00

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getWeekDays(anchor: Date): Date[] {
  const day = anchor.getDay(); // 0=Sun
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((day + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function getMonthDays(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  // Pad to start on Monday
  const startPad = (first.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = -startPad; i < last.getDate(); i++) {
    const d = new Date(year, month, i + 1);
    days.push(d);
  }
  // Pad end to full weeks
  while (days.length % 7 !== 0) {
    const d = new Date(days[days.length - 1]);
    d.setDate(d.getDate() + 1);
    days.push(d);
  }
  return days;
}

function bookingsForDay(bookings: Booking[], day: Date) {
  return bookings.filter((b) => {
    const s = new Date(b.start_time);
    return isSameDay(s, day) && b.status !== 'cancelled' && b.status !== 'rejected';
  });
}

function fmt12(hour: number) {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

function fmtTime(dt: string) {
  const d = new Date(dt);
  // Use local time components to avoid UTC offset shift
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function ConferenceCalendar({ bookings, onSlotClick, onBookingClick, canRequest = false }: Props) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [anchor, setAnchor] = useState(new Date());
  const today = new Date();

  const weekDays = useMemo(() => getWeekDays(anchor), [anchor]);
  const monthDays = useMemo(() => getMonthDays(anchor.getFullYear(), anchor.getMonth()), [anchor]);

  const navigate = (dir: -1 | 1) => {
    const d = new Date(anchor);
    if (view === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setMonth(d.getMonth() + dir);
    setAnchor(d);
  };

  const periodLabel = view === 'week'
    ? `${weekDays[0].toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : anchor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="w-full">
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-sm font-semibold hover:bg-[#F8FAFC]">‹</button>
          <span className="min-w-[200px] text-center text-sm font-bold text-[#344054]">{periodLabel}</span>
          <button onClick={() => navigate(1)} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-sm font-semibold hover:bg-[#F8FAFC]">›</button>
          <button onClick={() => setAnchor(new Date())} className="rounded-lg border border-[#E3E7EE] px-3 py-1.5 text-xs font-semibold hover:bg-[#F8FAFC]">Today</button>
        </div>
        <div className="flex rounded-lg border border-[#E3E7EE] overflow-hidden">
          {(['week', 'month'] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-semibold transition-colors capitalize ${view === v ? 'bg-[#FF3B3B] text-white' : 'bg-white text-[#344054] hover:bg-[#F8FAFC]'}`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap gap-4 text-xs font-medium">
        {[['approved', 'Approved'], ['pending', 'Pending']].map(([s, l]) => (
          <span key={s} className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s] }} />
            {l}
          </span>
        ))}
        {canRequest && <span className="text-[#667085]">Click an empty slot to request a booking</span>}
      </div>

      {/* WEEK VIEW */}
      {view === 'week' && (
        <div className="overflow-x-auto rounded-xl border border-[#E3E7EE] bg-white">
          <div className="min-w-[700px]">
            {/* Day headers */}
            <div className="grid border-b border-[#E3E7EE]" style={{ gridTemplateColumns: '56px repeat(7, 1fr)' }}>
              <div className="border-r border-[#E3E7EE]" />
              {weekDays.map((d) => {
                const isToday = isSameDay(d, today);
                return (
                  <div key={d.toISOString()} className={`border-r border-[#E3E7EE] py-2 text-center text-xs font-bold last:border-r-0 ${isToday ? 'bg-[#FFF7F7] text-[#FF3B3B]' : 'text-[#344054]'}`}>
                    <div>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d.getDay() === 0 ? 6 : d.getDay() - 1]}</div>
                    <div className={`mt-0.5 text-base font-extrabold ${isToday ? 'text-[#FF3B3B]' : ''}`}>{d.getDate()}</div>
                  </div>
                );
              })}
            </div>

            {/* Hour rows */}
            <div className="relative">
              {HOURS.map((hour) => (
                <div key={hour} className="grid border-b border-[#E3E7EE] last:border-b-0" style={{ gridTemplateColumns: '56px repeat(7, 1fr)', minHeight: '48px' }}>
                  <div className="border-r border-[#E3E7EE] px-1 pt-1 text-right text-[10px] text-[#9CA3AF]">{String(hour).padStart(2, '0')}:00</div>
                  {weekDays.map((day) => {
                    const dayBookings = bookings.filter((b) => {
                      const s = new Date(b.start_time);
                      const e = new Date(b.end_time);
                      return isSameDay(s, day) &&
                        s.getHours() <= hour &&
                        e.getHours() > hour &&
                        b.status !== 'cancelled' && b.status !== 'rejected';
                    });
                    const isPast = day < today && !isSameDay(day, today);
                    return (
                      <div key={day.toISOString()}
                        className={`relative border-r border-[#E3E7EE] p-0.5 last:border-r-0 ${canRequest && !isPast && dayBookings.length === 0 ? 'cursor-pointer hover:bg-[#FFF7F7]' : ''}`}
                        onClick={() => {
                          if (canRequest && !isPast && dayBookings.length === 0 && onSlotClick) {
                            onSlotClick(day, hour);
                          }
                        }}
                      >
                        {dayBookings.map((b) => {
                          const s = new Date(b.start_time);
                          // Only render the event in its starting hour
                          if (s.getHours() !== hour) return null;
                          const durationH = (new Date(b.end_time).getTime() - s.getTime()) / 3600000;
                          return (
                            <div key={b.id}
                              onClick={(e) => { e.stopPropagation(); onBookingClick?.(b); }}
                              className="absolute left-0.5 right-0.5 z-10 cursor-pointer overflow-hidden rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                              style={{
                                top: `${(s.getMinutes() / 60) * 48}px`,
                                height: `${durationH * 48 - 2}px`,
                                backgroundColor: STATUS_COLORS[b.status],
                                border: b.status === 'pending' ? '2px dashed rgba(0,0,0,0.3)' : 'none',
                                minHeight: '18px',
                              }}
                              title={`${b.title} (${fmtTime(b.start_time)}–${fmtTime(b.end_time)})`}
                            >
                              {b.title}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MONTH VIEW */}
      {view === 'month' && (
        <div className="overflow-hidden rounded-xl border border-[#E3E7EE] bg-white">
          {/* Day names */}
          <div className="grid grid-cols-7 border-b border-[#E3E7EE]">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
              <div key={d} className="border-r border-[#E3E7EE] py-2 text-center text-xs font-bold text-[#667085] last:border-r-0">{d}</div>
            ))}
          </div>
          {/* Weeks */}
          <div className="grid grid-cols-7">
            {monthDays.map((day, idx) => {
              const isCurrentMonth = day.getMonth() === anchor.getMonth();
              const isToday = isSameDay(day, today);
              const dayBkgs = bookingsForDay(bookings, day);
              const isPast = day < today && !isSameDay(day, today);
              return (
                <div key={idx}
                  className={`min-h-[80px] border-b border-r border-[#E3E7EE] p-1 last:border-r-0 ${isCurrentMonth ? 'bg-white' : 'bg-[#F8FAFC]'} ${canRequest && !isPast && isCurrentMonth ? 'cursor-pointer hover:bg-[#FFF7F7]' : ''}`}
                  onClick={() => {
                    if (canRequest && !isPast && isCurrentMonth && onSlotClick) {
                      onSlotClick(day, 9); // default to 09:00
                    }
                  }}
                >
                  <div className={`mb-1 text-xs font-bold ${isToday ? 'flex h-5 w-5 items-center justify-center rounded-full bg-[#FF3B3B] text-white' : isCurrentMonth ? 'text-[#344054]' : 'text-[#CBD5E1]'}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-0.5">
                    {dayBkgs.slice(0, 3).map((b) => (
                      <div key={b.id}
                        onClick={(e) => { e.stopPropagation(); onBookingClick?.(b); }}
                        className="cursor-pointer truncate rounded px-1 py-0.5 text-[10px] font-semibold text-white"
                        style={{ backgroundColor: STATUS_COLORS[b.status] }}
                        title={`${b.title} ${fmtTime(b.start_time)}–${fmtTime(b.end_time)}`}
                      >
                        {fmtTime(b.start_time)} {b.title}
                      </div>
                    ))}
                    {dayBkgs.length > 3 && (
                      <div className="text-[10px] text-[#667085]">+{dayBkgs.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
