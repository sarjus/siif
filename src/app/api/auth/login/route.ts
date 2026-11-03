import { NextRequest, NextResponse } from 'next/server';
import { createAuthSession, getAccountByEmail, setSessionCookie, toAppUser, verifyPassword } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || typeof body.password !== 'string') {
      return NextResponse.json({ error: { message: 'Email and password are required.' } }, { status: 400 });
    }

    const account = await getAccountByEmail(email);
    if (!account || !(await verifyPassword(body.password, account.password_hash))) {
      return NextResponse.json({ error: { message: 'Invalid email or password.' } }, { status: 401 });
    }

    const token = await createAuthSession(account.id);
    const user = toAppUser(account);
    const response = NextResponse.json({
      user,
      session: {
        user,
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      },
    });
    setSessionCookie(response, token);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: { message: error instanceof Error ? error.message : 'Login failed.' } },
      { status: 500 }
    );
  }
}
