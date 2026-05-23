import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { sendGbpSetupGuideEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteId, recipientEmail, recipientName } = body;

  if (!siteId || !recipientEmail) {
    return NextResponse.json({ error: 'siteId and recipientEmail are required' }, { status: 400 });
  }

  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('user_id, business_profile, design_data, custom_domain, site_slug')
    .eq('id', siteId)
    .single();

  if (fetchError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.user_id && site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const bp = site.business_profile as Record<string, string> | null;
  if (!bp?.legalName) {
    return NextResponse.json({ error: 'Business profile must be saved first' }, { status: 400 });
  }

  const siteUrl = site.custom_domain
    ? `https://${site.custom_domain}`
    : site.site_slug
      ? `https://${site.site_slug}.keystoneweb.ca`
      : '';

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keystoneweb.ca';

  const result = await sendGbpSetupGuideEmail({
    recipientEmail,
    recipientName: recipientName || undefined,
    businessName: bp.legalName,
    streetAddress: bp.streetAddress || '',
    city: bp.addressLocality || '',
    region: bp.addressRegion || '',
    postalCode: bp.postalCode || '',
    country: bp.addressCountry || '',
    phone: bp.telephone || '',
    siteUrl,
    adminDashboardUrl: `${appUrl}/admin/seo`,
  });

  if (!result.success) {
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }

  const designData = (site.design_data as Record<string, unknown>) || {};
  await supabase
    .from('sites')
    .update({
      design_data: {
        ...designData,
        gbpSetupEmailSentAt: new Date().toISOString(),
        gbpSetupEmailSentTo: recipientEmail,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  return NextResponse.json({ success: true });
}
