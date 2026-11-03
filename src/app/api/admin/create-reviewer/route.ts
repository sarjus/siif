import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { RowDataPacket } from 'mysql2/promise';
import { getMysqlPool } from '@/lib/mysql';
import { hashPassword, requireAdmin } from '@/lib/server-auth';

export async function POST(request: NextRequest) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;

    const body = await request.json() as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const pool = getMysqlPool();
    const connection = await pool.getConnection();
    const userId = randomUUID();
    const reviewerId = randomUUID();

    try {
      await connection.beginTransaction();
      const [existing] = await connection.execute<RowDataPacket[]>(
        'SELECT `id` FROM `auth_users` WHERE `email` = ? LIMIT 1',
        [email]
      );
      if (existing.length > 0) {
        await connection.rollback();
        return NextResponse.json({ error: 'An account already exists for this email.' }, { status: 409 });
      }

      const passwordHash = await hashPassword(password);
      await connection.execute(
        'INSERT INTO `auth_users` (`id`, `email`, `role`, `password_hash`, `metadata`) VALUES (?, ?, ?, ?, ?)',
        [userId, email, 'reviewer', passwordHash, JSON.stringify({})]
      );
      await connection.execute(
        'INSERT INTO `reviewers` (`id`, `user_id`, `name`, `email`) VALUES (?, ?, ?, ?)',
        [reviewerId, userId, name, email]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return NextResponse.json({
      reviewer: {
        id: reviewerId,
        user_id: userId,
        name,
        email,
        is_active: true,
      },
    });
  } catch (error) {
    console.error('Failed to create reviewer account:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
