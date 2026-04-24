import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

    if (!serviceRoleKey || !supabaseUrl) {
      return NextResponse.json(
        { error: 'Server configuration error: missing service role key' },
        { status: 500 }
      );
    }

    // Admin client – service role key is ONLY used server-side here
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create the Supabase auth user
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 400 });
    }

    // Insert reviewer profile record
    const { data: reviewerData, error: reviewerError } = await supabaseAdmin
      .from('reviewers')
      .insert([{ user_id: userData.user.id, name, email }])
      .select()
      .single();

    if (reviewerError) {
      // Rollback: delete the auth user we just created
      await supabaseAdmin.auth.admin.deleteUser(userData.user.id);
      return NextResponse.json({ error: reviewerError.message }, { status: 400 });
    }

    return NextResponse.json({ reviewer: reviewerData });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
