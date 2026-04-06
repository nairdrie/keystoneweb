import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { generateSecureToken, getPasswordResetExpiresAt } from '@/lib/membership/auth';
import { sendMemberPasswordResetEmail } from '@/lib/email';

/** POST /api/membership/forgot-password */
export async function POST(request: NextRequest) {
  try {
    const { siteId, email } = await request.json();

    if (!siteId || !email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    const supabase = createAdminClient();

    const { data: member } = await supabase
      .from('members')
      .select('id, name')
      .eq('site_id', siteId)
      .eq('email', emailLower)
      .in('status', ['active', 'pending'])
      .single();

    // Always return success to prevent email enumeration
    if (!member) {
      return NextResponse.json({ success: true });
    }

    const resetToken = generateSecureToken();
    const expiresAt = getPasswordResetExpiresAt();

    await supabase
      .from('members')
      .update({
        password_reset_token: resetToken,
        password_reset_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.id);

    // Fetch site + settings for branding and custom template
    const [{ data: site }, { data: settings }] = await Promise.all([
      supabase.from('sites').select('published_domain, custom_domain, site_slug').eq('id', siteId).single(),
      supabase.from('membership_settings').select('password_reset_subject, password_reset_body, password_reset_cta_enabled, password_reset_cta_label, branding').eq('site_id', siteId).single(),
    ]);

    const siteName = site?.custom_domain || site?.published_domain || site?.site_slug || undefined;
    const siteDomain = site?.custom_domain
      ? `https://${site.custom_domain}`
      : site?.published_domain
        ? `https://${site.published_domain}.kswd.ca`
        : request.nextUrl.origin;

    const resetUrl = `${siteDomain}/forgot-password?token=${resetToken}&siteId=${siteId}&action=reset`;

    await sendMemberPasswordResetEmail({
      memberEmail: emailLower,
      memberName: member.name || undefined,
      siteName,
      resetUrl,
      customSubject: settings?.password_reset_subject || undefined,
      customBody: settings?.password_reset_body || undefined,
      ctaEnabled: settings?.password_reset_cta_enabled ?? true,
      ctaLabel: settings?.password_reset_cta_label || undefined,
      branding: settings?.branding || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
