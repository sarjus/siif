import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getMysqlPool } from '@/lib/mysql';
import { clearSessionCookie, getRequestUser, getSessionTokenFromRequest } from '@/lib/server-auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    const session = user
      ? { user, expires_at: Math.floor(Date.now() / 1000) + 60 * 60 }
      : null;
    return NextResponse.json({ user, session });
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Session lookup failed.' } },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getSessionTokenFromRequest(request);
    if (token) {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      await getMysqlPool().execute(
        'DELETE FROM `auth_sessions` WHERE `token_hash` = ?',
        [tokenHash]
      );
    }
    const response = NextResponse.json({ success: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Sign out failed.' } },
      { status: 500 }
    );
  }
}
