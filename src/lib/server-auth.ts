import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const getEnv = (name: string) => (process.env[name] || '').trim();

export const createServiceRoleClient = (): SupabaseClient => {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const createAnonClient = (): SupabaseClient => {
  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    throw new Error('Missing Supabase public auth configuration.');
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
};

const getBearerToken = (request: NextRequest) => {
  const authHeader = request.headers.get('authorization') || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim();
};

export const getRequestUser = async (request: NextRequest): Promise<User | null> => {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

export const isAdminUser = (user: User | null) => {
  if (!user) return false;

  const role = String(user.user_metadata?.role || '').toLowerCase();
  if (role === 'admin') return true;

  const email = (user.email || '').trim().toLowerCase();
  const adminEmails = getEnv('ADMIN_EMAILS')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return !!email && adminEmails.includes(email);
};

export const requireAdmin = async (request: NextRequest) => {
  const user = await getRequestUser(request);
  if (!isAdminUser(user)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { user, response: null };
};

export const getCompanyApplicationIdForUser = async (
  supabaseAdmin: SupabaseClient,
  user: User,
  companyId: string
) => {
  if (String(user.user_metadata?.role || '') !== 'company') return null;

  const email = (user.email || '').trim().toLowerCase();
  if (!email) return null;

  const { data, error } = await supabaseAdmin
    .from('applications')
    .select('id')
    .eq('id', companyId)
    .ilike('email', email)
    .eq('status', 'approved')
    .maybeSingle();

  if (error) throw error;
  return data?.id || null;
};
