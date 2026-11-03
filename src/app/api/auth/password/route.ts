import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/lib/mysql';
import { getRequestUser, getSessionTokenFromRequest, hashPassword, updateUserPassword } from '@/lib/server-auth';

type ResetRow = RowDataPacket & { id: string; user_id: string };

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { password?: string; recoveryToken?: string };
    if (typeof body.password !== 'string' || body.password.length < 8) {
      return NextResponse.json({ error: { message: 'Password must be at least 8 characters.' } }, { status: 400 });
    }

    if (body.recoveryToken) {
      const tokenHash = createHash('sha256').update(body.recoveryToken).digest('hex');
      const connection = await getMysqlPool().getConnection();
      try {
        await connection.beginTransaction();
        const [rows] = await connection.execute<ResetRow[]>(
          'SELECT `id`, `user_id` FROM `password_resets` WHERE `token_hash` = ? AND `used_at` IS NULL AND `expires_at` > UTC_TIMESTAMP() FOR UPDATE',
          [tokenHash]
        );
        const reset = rows[0];
        if (!reset) {
          await connection.rollback();
          return NextResponse.json({ error: { message: 'This password reset link is invalid or expired.' } }, { status: 400 });
        }
        const passwordHash = await hashPassword(body.password);
        await connection.execute(
          'UPDATE `auth_users` SET `password_hash` = ?, `must_reset_password` = FALSE, `updated_at` = UTC_TIMESTAMP() WHERE `id` = ?',
          [passwordHash, reset.user_id]
        );
        await connection.execute('DELETE FROM `auth_sessions` WHERE `user_id` = ?', [reset.user_id]);
        await connection.execute(
          'UPDATE `password_resets` SET `used_at` = UTC_TIMESTAMP() WHERE `user_id` = ? AND `used_at` IS NULL',
          [reset.user_id]
        );
        await connection.commit();
        return NextResponse.json({ success: true });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    }

    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: { message: 'Sign in to change your password.' } }, { status: 401 });
    const token = getSessionTokenFromRequest(request);
    const currentSessionHash = token ? createHash('sha256').update(token).digest('hex') : undefined;
    await updateUserPassword(user.id, body.password, false, currentSessionHash);
    return NextResponse.json({ user: { ...user, user_metadata: { ...user.user_metadata, must_reset_password: false } } });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Password update failed.' } },
      { status: 500 }
    );
  }
}
