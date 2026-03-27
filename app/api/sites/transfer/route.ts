import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { trackEvent } from '@/lib/analytics';
import { sendSiteTransferEmail } from '@/lib/email';

// POST - Initiate a site transfer by emailing the recipient
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { siteId, recipientEmail, includeDomain } = await request.json();

    if (!siteId) {
      return NextResponse.json({ error: 'Site ID is required' }, { status: 400 });
    }
    if (!recipientEmail || !recipientEmail.includes('@')) {
      return NextResponse.json({ error: 'A valid recipient email is required' }, { status: 400 });
    }
    if (recipientEmail.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot transfer a site to yourself' }, { status: 400 });
    }

    // Verify ownership and fetch site info
    const { data: site, error: fetchError } = await supabase
      .from('sites')
      .select('id, user_id, site_slug, custom_domain')
      .eq('id', siteId)
      .single();

    if (fetchError || !site) {
      return NextResponse.json({ error: 'Site not found' }, { status: 404 });
    }
    if (site.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You can only transfer your own sites' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Cancel any existing pending transfers for this site
    await admin
      .from('site_transfers')
      .update({ status: 'cancelled' })
      .eq('site_id', siteId)
      .eq('status', 'pending');

    // Generate a secure token
    const token = randomBytes(32).toString('hex');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://keystoneweb.ca';
    const transferUrl = `${baseUrl}/transfer?token=${token}`;

    // Check if recipient already has a Keystone account
    const { data: recipientUser } = await admin
      .from('users')
      .select('id')
      .eq('email', recipientEmail.toLowerCase())
      .maybeSingle();

    let recipientHasPaidPlan = false;
    if (recipientUser) {
      const { data: recipientSub } = await admin
        .from('user_subscriptions')
        .select('subscription_status')
        .eq('user_id', recipientUser.id)
        .maybeSingle();
      recipientHasPaidPlan = recipientSub?.subscription_status === 'active';
    }

    // Resolve domain name to include
    const domainName = includeDomain ? (site.custom_domain || null) : null;

    // Create the transfer record
    const { error: insertError } = await admin.from('site_transfers').insert({
      site_id: siteId,
      from_user_id: user.id,
      token,
      status: 'pending',
      recipient_email: recipientEmail.toLowerCase(),
      include_domain: !!includeDomain,
    });

    if (insertError) {
      console.error('Error creating transfer:', insertError);
      return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
    }

    // Fetch sender display name
    const { data: sender } = await admin
      .from('users')
      .select('business_name')
      .eq('id', user.id)
      .maybeSingle();

    // Send the transfer email
    await sendSiteTransferEmail({
      recipientEmail: recipientEmail.toLowerCase(),
      senderName: sender?.business_name || '',
      senderEmail: user.email!,
      siteName: site.site_slug,
      transferUrl,
      includeDomain: !!includeDomain,
      domainName,
      recipientHasAccount: !!recipientUser,
      recipientHasPaidPlan,
    });

    trackEvent('site_transfer_created', {
      userId: user.id,
      siteId,
      metadata: { siteName: site.site_slug, recipientEmail, includeDomain: !!includeDomain },
    });

    return NextResponse.json({ success: true, message: 'Transfer email sent' });
  } catch (error) {
    console.error('Error creating transfer:', error);
    return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
  }
}

// GET - Get transfer details by token (public, used by the transfer page)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: transfer, error } = await admin
      .from('site_transfers')
      .select('id, site_id, from_user_id, status, created_at, expires_at, include_domain, recipient_email')
      .eq('token', token)
      .single();

    if (error || !transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (transfer.status !== 'pending') {
      return NextResponse.json({ error: 'Transfer is no longer available', status: transfer.status }, { status: 410 });
    }

    if (new Date(transfer.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Transfer link has expired' }, { status: 410 });
    }

    // Fetch site info
    const { data: site } = await admin
      .from('sites')
      .select('site_slug, custom_domain')
      .eq('id', transfer.site_id)
      .single();

    const { data: sender } = await admin
      .from('users')
      .select('email, business_name')
      .eq('id', transfer.from_user_id)
      .single();

    return NextResponse.json({
      transferId: transfer.id,
      siteId: transfer.site_id,
      siteName: site?.site_slug || 'Untitled Site',
      senderEmail: sender?.email || 'Unknown',
      senderName: sender?.business_name || null,
      expiresAt: transfer.expires_at,
      includeDomain: transfer.include_domain,
      domainName: transfer.include_domain ? (site?.custom_domain || null) : null,
      recipientEmail: transfer.recipient_email || null,
    });
  } catch (error) {
    console.error('Error fetching transfer:', error);
    return NextResponse.json({ error: 'Failed to fetch transfer' }, { status: 500 });
  }
}
