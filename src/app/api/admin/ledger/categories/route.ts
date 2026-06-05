import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient, requireAdmin } from '@/lib/server-auth';

// GET — list all categories
export async function GET(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('ledger_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ categories: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to load categories' }, { status: 500 });
  }
}

// POST — add a new category
export async function POST(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { name } = await request.json() as { name?: string };
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
    }

    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from('ledger_categories')
      .insert({ name: name.trim() })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'This category already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ category: data });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to add category' }, { status: 500 });
  }
}

// DELETE — remove a category
export async function DELETE(request: NextRequest) {
  try {
    const { user, response } = await requireAdmin(request);
    if (!user) return response!;

    const { categoryId } = await request.json() as { categoryId?: string };
    if (!categoryId) return NextResponse.json({ error: 'Category ID is required.' }, { status: 400 });

    const supabase = createServiceRoleClient();

    // Check if any ledger entries use this category
    const { count } = await supabase
      .from('siif_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('category', (await supabase.from('ledger_categories').select('name').eq('id', categoryId).maybeSingle()).data?.name || '');

    if (count && count > 0) {
      return NextResponse.json({ error: `Cannot delete — ${count} ledger entr${count === 1 ? 'y uses' : 'ies use'} this category.` }, { status: 409 });
    }

    const { error } = await supabase.from('ledger_categories').delete().eq('id', categoryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed to delete category' }, { status: 500 });
  }
}
