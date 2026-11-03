import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import type { AppUser } from '@/lib/auth-types';
import { createMysqlClient, getMysqlPool } from '@/lib/mysql';
import type { MysqlClient } from '@/lib/mysql-client';

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE_NAME = 'siif_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type AccountRow = RowDataPacket & {
  id: string;
  email: string;
  role: 'admin' | 'company' | 'reviewer';
  password_hash: string;
  metadata: string | Record<string, unknown> | null;
  must_reset_password: number | boolean;
};

const parseMetadata = (metadata: AccountRow['metadata']) => {
  if (!metadata) return {};
  if (typeof metadata !== 'string') return metadata;
  try {
    const parsed: unknown = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    throw new Error('Stored account metadata is invalid JSON.');
  }
};

export const toAppUser = (account: AccountRow): AppUser => {
  const metadata = parseMetadata(account.metadata);
  return {
    id: account.id,
    email: account.email,
    user_metadata: {
      ...metadata,
      role: account.role,
      must_reset_password: Boolean(account.must_reset_password),
    },
    app_metadata: { role: account.role },
  };
};

export const hashPassword = async (password: string) => {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${key.toString('hex')}`;
};

export const verifyPassword = async (password: string, encoded: string) => {
  const [algorithm, salt, expectedHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !salt || !/^[0-9a-f]{128}$/i.test(expectedHex || '')) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = await scrypt(password, salt, expected.length) as Buffer;
  return timingSafeEqual(actual, expected);
};

export const createUserAccount = async (input: {
  email: string;
  password: string;
  role: AppUser['user_metadata']['role'];
  metadata?: Record<string, unknown>;
  mustResetPassword?: boolean;
}) => {
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await getMysqlPool().execute(
    'INSERT INTO `auth_users` (`id`, `email`, `role`, `password_hash`, `metadata`, `must_reset_password`) VALUES (?, ?, ?, ?, ?, ?)',
    [
      id,
      input.email.trim().toLowerCase(),
      input.role,
      passwordHash,
      JSON.stringify(input.metadata || {}),
      input.mustResetPassword ? 1 : 0,
    ]
  );
  return id;
};

export const recreateUserAccount = async (input: {
  id: string;
  email: string;
  password: string;
  role: AppUser['user_metadata']['role'];
  metadata: Record<string, unknown>;
}) => {
  const passwordHash = await hashPassword(input.password);
  await getMysqlPool().execute(
    'UPDATE `auth_users` SET `email` = ?, `role` = ?, `password_hash` = ?, `metadata` = ?, `must_reset_password` = TRUE, `is_active` = TRUE, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
    [input.email.trim().toLowerCase(), input.role, passwordHash, JSON.stringify(input.metadata), input.id]
  );
  await getMysqlPool().execute('DELETE FROM `auth_sessions` WHERE `user_id` = ?', [input.id]);
};

export const updateUserPassword = async (
  userId: string,
  password: string,
  mustResetPassword = false,
  retainSessionHash?: string
) => {
  const passwordHash = await hashPassword(password);
  await getMysqlPool().execute(
    'UPDATE `auth_users` SET `password_hash` = ?, `must_reset_password` = ?, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
    [passwordHash, mustResetPassword ? 1 : 0, userId]
  );
  if (retainSessionHash) {
    await getMysqlPool().execute(
      'DELETE FROM `auth_sessions` WHERE `user_id` = ? AND `token_hash` <> ?',
      [userId, retainSessionHash]
    );
  } else {
    await getMysqlPool().execute('DELETE FROM `auth_sessions` WHERE `user_id` = ?', [userId]);
  }
};

export const createAuthSession = async (userId: string) => {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await getMysqlPool().execute(
    'INSERT INTO `auth_sessions` (`id`, `user_id`, `token_hash`, `expires_at`) VALUES (?, ?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? SECOND))',
    [randomUUID(), userId, tokenHash, SESSION_TTL_SECONDS]
  );
  return token;
};

export const setSessionCookie = (response: NextResponse, token: string) => {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
};

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
};

const readSessionToken = (request: NextRequest) => request.cookies.get(SESSION_COOKIE_NAME)?.value;

export const getRequestUser = async (request: NextRequest): Promise<AppUser | null> => {
  const token = readSessionToken(request);
  if (!token) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const [rows] = await getMysqlPool().execute<AccountRow[]>(
    `SELECT u.\`id\`, u.\`email\`, u.\`role\`, u.\`password_hash\`, u.\`metadata\`, u.\`must_reset_password\`
     FROM \`auth_sessions\` s
     INNER JOIN \`auth_users\` u ON u.\`id\` = s.\`user_id\`
     WHERE s.\`token_hash\` = ? AND s.\`expires_at\` > UTC_TIMESTAMP() AND u.\`is_active\` = TRUE
     LIMIT 1`,
    [tokenHash]
  );
  return rows[0] ? toAppUser(rows[0]) : null;
};

export const getAccountByEmail = async (email: string) => {
  const [rows] = await getMysqlPool().execute<AccountRow[]>(
    'SELECT `id`, `email`, `role`, `password_hash`, `metadata`, `must_reset_password` FROM `auth_users` WHERE `email` = ? AND `is_active` = TRUE LIMIT 1',
    [email.trim().toLowerCase()]
  );
  return rows[0] || null;
};

export const isAdminUser = (user: AppUser | null) => {
  if (!user) return false;
  return user.user_metadata.role === 'admin';
};

export const isEffectiveAdminUser = async (user: AppUser | null) => isAdminUser(user);

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

export const createDatabaseClient = (): MysqlClient =>
  createMysqlClient();

export const getCompanyApplicationIdForUser = async (
  database: MysqlClient,
  user: AppUser,
  companyId: string
) => {
  if (String(user.user_metadata?.role || '') !== 'company') return null;
  const email = (user.email || '').trim().toLowerCase();
  if (!email) return null;
  const { data, error } = await database
    .from('applications')
    .select('id')
    .eq('id', companyId)
    .ilike('email', email)
    .eq('status', 'approved')
    .maybeSingle();
  if (error) throw error;
  return data?.id || null;
};

export const getSessionTokenFromRequest = readSessionToken;
