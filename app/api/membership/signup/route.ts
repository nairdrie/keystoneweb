import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import {
  hashPassword,
  generateSecureToken,
  getVerificationExpiresAt,
} from '@/lib/membership/auth';
import {
  sendMemberVerificationEmail,
  sendMemberSignupNotification,
} from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { siteId, email, password, name, packageId, customFields, marketingOptIn } = body;

    if (!siteId || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const emailLower = email.trim().toLowerCase();
    if (emailLower.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify site exists and has membership enabled
    const { data: site } = await supabase
      .from('sites')
      .select('id, published_domain, site_slug, custom_domain')
      .eq('id', siteId)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }

    // Check for existing member
    const { data: existing } = await supabase
      .from('members')
      .select('id, status')
      .eq('site_id', siteId)
      .eq('email', emailLower)
      .single();

    if (existing) {
      if (existing.status === 'cancelled') {
        // Allow re-signup for cancelled members
        const passwordHash = await hashPassword(password);
        const verificationToken = generateSecureToken();

        await supabase
          .from('members')
          .update({
            password_hash: passwordHash,
            name: name || null,
            custom_fields: customFields || {},
            status: 'pending',
            email_verified: false,
            email_verification_token: verificationToken,
            email_verification_expires_at: getVerificationExpiresAt().toISOString(),
            package_id: packageId || null,
            marketing_opt_in: !!marketingOptIn,
            signed_up_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        const [{ data: reSettings }, { data: reExtSettings }] = await Promise.all([
          supabase.from('membership_settings').select('notification_email, branding').eq('site_id', siteId).single(),
          supabase.from('membership_settings').select('email_verification_subject, email_verification_body, email_verification_cta_enabled, email_verification_cta_label').eq('site_id', siteId).single(),
        ]);

        const siteName = site.site_slug || site.custom_domain || site.published_domain || undefined;
        const verificationUrl = `${request.nextUrl.origin}/api/membership/verify-email?token=${verificationToken}&siteId=${siteId}`;

        await sendMemberVerificationEmail({
          memberEmail: emailLower,
          memberName: name || undefined,
          siteName,
          verificationUrl,
          customSubject: reExtSettings?.email_verification_subject || undefined,
          customBody: reExtSettings?.email_verification_body || undefined,
          ctaEnabled: reExtSettings?.email_verification_cta_enabled ?? true,
          ctaLabel: reExtSettings?.email_verification_cta_label || undefined,
          branding: reSettings?.branding || undefined,
        });

        if (reSettings?.notification_email) {
          await sendMemberSignupNotification({
            ownerEmail: reSettings.notification_email,
            memberEmail: emailLower,
            memberName: name || undefined,
            siteName,
          });
        }

        return NextResponse.json({ success: true, requiresVerification: true });
      }
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
    }

    // Fetch settings — split into base (guaranteed) + extended (migration 042/043) queries
    // so a missing migration doesn't prevent branding from being applied.
    const { data: settings } = await supabase
      .from('membership_settings')
      .select('require_email_verification, notification_email, branding')
      .eq('site_id', siteId)
      .single();

    const { data: extSettings } = await supabase
      .from('membership_settings')
      .select('email_verification_subject, email_verification_body, email_verification_cta_enabled, email_verification_cta_label')
      .eq('site_id', siteId)
      .single();

    const requireVerification = settings?.require_email_verification ?? true;
    const passwordHash = await hashPassword(password);
    const verificationToken = requireVerification ? generateSecureToken() : null;

    const { data: member, error: insertError } = await supabase
      .from('members')
      .insert({
        site_id: siteId,
        email: emailLower,
        password_hash: passwordHash,
        name: name || null,
        custom_fields: customFields || {},
        status: requireVerification ? 'pending' : 'active',
        email_verified: !requireVerification,
        email_verification_token: verificationToken,
        email_verification_expires_at: requireVerification
          ? getVerificationExpiresAt().toISOString()
          : null,
        package_id: packageId || null,
        marketing_opt_in: !!marketingOptIn,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Member signup error:', insertError);
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    const siteName = site.site_slug || site.custom_domain || site.published_domain || undefined;

    if (requireVerification && verificationToken) {
      const verificationUrl = `${request.nextUrl.origin}/api/membership/verify-email?token=${verificationToken}&siteId=${siteId}`;
      await sendMemberVerificationEmail({
        memberEmail: emailLower,
        memberName: name || undefined,
        siteName,
        verificationUrl,
        customSubject: extSettings?.email_verification_subject || undefined,
        customBody: extSettings?.email_verification_body || undefined,
        ctaEnabled: extSettings?.email_verification_cta_enabled ?? true,
        ctaLabel: extSettings?.email_verification_cta_label || undefined,
        branding: settings?.branding || undefined,
      });
    }

    if (settings?.notification_email) {
      await sendMemberSignupNotification({
        ownerEmail: settings.notification_email,
        memberEmail: emailLower,
        memberName: name || undefined,
        siteName,
      });
    }

    return NextResponse.json({
      success: true,
      memberId: member.id,
      requiresVerification: requireVerification,
    });
  } catch (error: any) {
    console.error('Membership signup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
