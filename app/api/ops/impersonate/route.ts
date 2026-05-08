import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_DOMAIN } from '@/lib/env/domain';
import { assertOpsAdmin } from '@/lib/ops/access';

const COOKIE_NAME = 'ksw_impersonate';

/**
 * POST /api/ops/impersonate
 * Body: { userId: string }
 */
export async function POST(request: NextRequest) {
  if (!await assertOpsAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { userId } = await request.json();
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, userId, {
    path: '/',
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 hours
  });

  return response;
}

/**
 * DELETE /api/ops/impersonate
 * Clears the impersonation cookie
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, '', {
    path: '/',
    domain: COOKIE_DOMAIN,
    maxAge: 0,
  });
  return response;
}
