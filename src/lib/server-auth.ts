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

const parseJwtPayload = (token: string): { sub?: string; exp?: number } | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8')) as { sub?: string; exp?: number };
  } catch {
    return null;
  }
};

export const getRequestUser = async (request: NextRequest): Promise<User | null> => {
  const token = getBearerToken(request);
  if (!token) return null;

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) return data.user;

  const payload = parseJwtPayload(token);
  if (!payload?.sub) return null;

  if (payload.exp && payload.exp * 1000 <= Date.now()) {
    return null;
  }

  const supabaseAdmin = createServiceRoleClient();
  const { data: adminData, error: adminError } = await supabaseAdmin.auth.admin.getUserById(payload.sub);
  if (adminError || !adminData.user) return null;
  return adminData.user;
};

export const isAdminUser = (user: User | null) => {
  if (!user) return false;

  const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
  if (role === 'admin') return true;

  const email = (user.email || '').trim().toLowerCase();
  const adminEmails = getEnv('ADMIN_EMAILS')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return !!email && adminEmails.includes(email);
};

const isReviewerUser = async (user: User) => {
  const supabaseAdmin = createServiceRoleClient();
  const { data, error } = await supabaseAdmin
    .from('reviewers')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return !!data;
};

export const isEffectiveAdminUser = async (user: User | null) => {
  if (!user) return false;
  if (isAdminUser(user)) return true;

  const role = String(user.user_metadata?.role || user.app_metadata?.role || '').toLowerCase();
  if (role === 'company' || role === 'reviewer') return false;

  // The client login flow routes authenticated non-company, non-reviewer users to admin.
  return !(await isReviewerUser(user));
};

export const requireAdmin = async (request: NextRequest) => {
  const user = await getRequestUser(request);
  if (!(await isEffectiveAdminUser(user))) {
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
