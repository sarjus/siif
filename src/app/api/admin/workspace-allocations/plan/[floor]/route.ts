import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/server-auth';

export async function GET(request: NextRequest, { params }: { params: Promise<{ floor: string }> }) {
  try {
    const { response } = await requireAdmin(request);
    if (response) return response;
    const { floor } = await params;
    const file = floor === 'general' ? join(process.cwd(), 'src/assets/workspace-plans/general-layout.jpg')
      : floor === 'mezzanine' ? join(process.cwd(), 'src/assets/workspace-plans/mezzanine.jpg') : null;
    if (!file) return NextResponse.json({ error: 'Floor plan not found.' }, { status: 404 });

    return new NextResponse(Uint8Array.from(await readFile(file)), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Failed to load workspace floor plan:', error);
    return NextResponse.json({ error: 'Could not load the floor plan image.' }, { status: 500 });
  }
}
