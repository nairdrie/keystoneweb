import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  verifyMemberTokenAny,
  hashToken,
  MEMBER_COOKIE_NAME,
} from '@/lib/membership/auth';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get(MEMBER_COOKIE_NAME)?.value;
    if (token) {
      const payload = await verifyMemberTokenAny(token);
      if (payload) {
        const supabase = createAdminClient();
        await supabase
          .from('member_sessions')
          .delete()
          .eq('token_hash', hashToken(token));
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(MEMBER_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error('Membership signout error:', error);
    // Always clear cookie even on error
    const response = NextResponse.json({ success: true });
    response.cookies.set(MEMBER_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return response;
  }
}
