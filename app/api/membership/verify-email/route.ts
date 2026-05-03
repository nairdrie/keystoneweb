import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';

/** GET /api/membership/verify-email?token=xxx&siteId=yyy */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const siteId = request.nextUrl.searchParams.get('siteId');

    if (!token || !siteId) {
      return NextResponse.json({ error: 'Invalid verification link' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: member } = await supabase
      .from('members')
      .select('id, email_verification_expires_at')
      .eq('site_id', siteId)
      .eq('email_verification_token', token)
      .eq('status', 'pending')
      .eq('is_archived', false)
      .single();

    if (!member) {
      return NextResponse.json({ error: 'Invalid or expired verification link' }, { status: 400 });
    }

    // Check expiry
    if (member.email_verification_expires_at && new Date(member.email_verification_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Verification link has expired. Please sign up again.' }, { status: 400 });
    }

    // Activate the member
    await supabase
      .from('members')
      .update({
        status: 'active',
        email_verified: true,
        email_verification_token: null,
        email_verification_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    // Redirect to signin page with success message
    // Determine the site's domain for redirect
    const { data: site } = await supabase
      .from('sites')
      .select('published_domain, custom_domain')
      .eq('id', siteId)
      .single();

    let redirectUrl = '/signin?verified=true';
    if (site?.custom_domain) {
      redirectUrl = `https://${site.custom_domain}/signin?verified=true`;
    } else if (site?.published_domain) {
      redirectUrl = `https://${site.published_domain}.kswd.ca/signin?verified=true`;
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error: any) {
    console.error('Email verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
