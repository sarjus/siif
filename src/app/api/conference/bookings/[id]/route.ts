/**
 * PATCH /api/conference/bookings/[id]  — Admin approves/rejects, company cancels
 */
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, getRequestUser, isEffectiveAdminUser } from '@/lib/server-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json() as {
      action: 'approve' | 'reject' | 'cancel';
      rejectionReason?: string;
    };

    const { action, rejectionReason } = body;
    if (!['approve', 'reject', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const isAdmin = await isEffectiveAdminUser(user);

    // Load booking
    const { data: booking } = await supabase
      .from('conference_bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!booking) return NextResponse.json({ error: 'Booking not found.' }, { status: 404 });

    if (action === 'cancel') {
      // Company can cancel their own pending booking
      if (!isAdmin) {
        const { data: app } = await supabase
          .from('applications')
          .select('id')
          .eq('id', booking.company_id)
          .ilike('email', user.email || '')
          .maybeSingle();
        if (!app) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
      }
      if (booking.status !== 'pending' && booking.status !== 'approved') {
        return NextResponse.json({ error: 'Only pending or approved bookings can be cancelled.' }, { status: 400 });
      }
      await supabase.from('conference_bookings').update({ status: 'cancelled' }).eq('id', id);
      return NextResponse.json({ success: true });
    }

    // Admin-only: approve/reject
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

    if (booking.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending bookings can be approved or rejected.' }, { status: 400 });
    }

    if (action === 'approve') {
      // Re-check conflicts before approving
      const { data: conflicts } = await supabase
        .from('conference_bookings')
        .select('id, title')
        .eq('status', 'approved')
        .neq('id', id)
        .lt('start_time', booking.end_time)
        .gt('end_time', booking.start_time);

      if (conflicts && conflicts.length > 0) {
        return NextResponse.json({
          error: `Cannot approve: conflicts with "${conflicts[0].title}".`
        }, { status: 409 });
      }

      await supabase.from('conference_bookings').update({
        status: 'approved',
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);
    } else {
      await supabase.from('conference_bookings').update({
        status: 'rejected',
        rejection_reason: rejectionReason || null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to update booking' }, { status: 500 });
  }
}
