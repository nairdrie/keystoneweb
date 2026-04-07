import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/** GET /api/membership/settings?siteId=xxx */
export async function GET(request: NextRequest) {
  try {
    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: settings } = await supabase
      .from('membership_settings')
      .select('*')
      .eq('site_id', siteId)
      .single();

    return NextResponse.json({ settings: settings || null });
  } catch (error: any) {
    console.error('Membership settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** PUT /api/membership/settings — Update or create settings (admin) */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, ...settingsData } = body;

    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    // Verify ownership
    const { data: site } = await supabase
      .from('sites')
      .select('id')
      .eq('id', siteId)
      .eq('user_id', user.id)
      .single();

    if (!site) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const dbData: Record<string, any> = {
      site_id: siteId,
      updated_at: new Date().toISOString(),
    };

    if (settingsData.isEnabled !== undefined) dbData.is_enabled = settingsData.isEnabled;
    if (settingsData.requireEmailVerification !== undefined) dbData.require_email_verification = settingsData.requireEmailVerification;
    if (settingsData.welcomeEmailSubject !== undefined) dbData.welcome_email_subject = settingsData.welcomeEmailSubject;
    if (settingsData.welcomeEmailBody !== undefined) dbData.welcome_email_body = settingsData.welcomeEmailBody;
    if (settingsData.emailVerificationSubject !== undefined) dbData.email_verification_subject = settingsData.emailVerificationSubject;
    if (settingsData.emailVerificationBody !== undefined) dbData.email_verification_body = settingsData.emailVerificationBody;
    if (settingsData.emailVerificationCtaEnabled !== undefined) dbData.email_verification_cta_enabled = settingsData.emailVerificationCtaEnabled;
    if (settingsData.emailVerificationCtaLabel !== undefined) dbData.email_verification_cta_label = settingsData.emailVerificationCtaLabel;
    if (settingsData.passwordResetSubject !== undefined) dbData.password_reset_subject = settingsData.passwordResetSubject;
    if (settingsData.passwordResetBody !== undefined) dbData.password_reset_body = settingsData.passwordResetBody;
    if (settingsData.passwordResetCtaEnabled !== undefined) dbData.password_reset_cta_enabled = settingsData.passwordResetCtaEnabled;
    if (settingsData.passwordResetCtaLabel !== undefined) dbData.password_reset_cta_label = settingsData.passwordResetCtaLabel;
    if (settingsData.welcomeCtaEnabled !== undefined) dbData.welcome_cta_enabled = settingsData.welcomeCtaEnabled;
    if (settingsData.welcomeCtaLabel !== undefined) dbData.welcome_cta_label = settingsData.welcomeCtaLabel;
    if (settingsData.signupFormFields !== undefined) dbData.signup_form_fields = settingsData.signupFormFields;
    if (settingsData.branding !== undefined) dbData.branding = settingsData.branding;
    if (settingsData.notificationEmail !== undefined) dbData.notification_email = settingsData.notificationEmail;
    if (settingsData.privacyPolicyUrl !== undefined) dbData.privacy_policy_url = settingsData.privacyPolicyUrl;
    if (settingsData.marketingOptInLabel !== undefined) dbData.marketing_opt_in_label = settingsData.marketingOptInLabel;
    if (settingsData.renewalEmailSubject !== undefined) dbData.renewal_email_subject = settingsData.renewalEmailSubject;
    if (settingsData.renewalEmailBody !== undefined) dbData.renewal_email_body = settingsData.renewalEmailBody;
    if (settingsData.renewalCtaEnabled !== undefined) dbData.renewal_cta_enabled = settingsData.renewalCtaEnabled;
    if (settingsData.renewalCtaLabel !== undefined) dbData.renewal_cta_label = settingsData.renewalCtaLabel;
    if (settingsData.cancellationEmailSubject !== undefined) dbData.cancellation_email_subject = settingsData.cancellationEmailSubject;
    if (settingsData.cancellationEmailBody !== undefined) dbData.cancellation_email_body = settingsData.cancellationEmailBody;
    if (settingsData.cancellationCtaEnabled !== undefined) dbData.cancellation_cta_enabled = settingsData.cancellationCtaEnabled;
    if (settingsData.cancellationCtaLabel !== undefined) dbData.cancellation_cta_label = settingsData.cancellationCtaLabel;

    // Upsert
    const { error } = await supabase
      .from('membership_settings')
      .upsert(dbData, { onConflict: 'site_id' });

    if (error) {
      console.error('Settings upsert error:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Membership settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
