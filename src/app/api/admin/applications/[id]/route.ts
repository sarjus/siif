import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { id: applicationId } = await params;
    if (!applicationId) {
      return NextResponse.json({ error: 'Application ID is required.' }, { status: 400 });
    }

    const supabaseAdmin = createServiceRoleClient();

    // Verify the application exists before deleting
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('applications')
      .select('id, business_name, status')
      .eq('id', applicationId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!existing) {
      return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    }

    // Delete the application — cascades to fee_settings, invoices, deposits,
    // fee_collections, application_references, application_assignments, etc.
    const { error: deleteError } = await supabaseAdmin
      .from('applications')
      .delete()
      .eq('id', applicationId);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, deleted: existing.business_name });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete application' },
      { status: 500 }
    );
  }
}
