import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/** GET /api/membership/campaigns?siteId=xxx */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const siteId = request.nextUrl.searchParams.get('siteId');
    if (!siteId) {
      return NextResponse.json({ error: 'Missing siteId' }, { status: 400 });
    }

    const { data: campaigns, error } = await supabase
      .from('member_email_campaigns')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
    }

    return NextResponse.json({ campaigns: campaigns || [] });
  } catch (error: any) {
    console.error('Campaigns list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** POST /api/membership/campaigns — Create or send campaign (admin) */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteId, subject, bodyText, targetPackageIds, scheduledAt, sendNow } = body;

    if (!siteId || !subject || !bodyText) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    const status = sendNow ? 'sending' : scheduledAt ? 'scheduled' : 'draft';

    const { data: campaign, error: insertError } = await supabase
      .from('member_email_campaigns')
      .insert({
        site_id: siteId,
        subject,
        body: bodyText,
        target_package_ids: targetPackageIds || [],
        status,
        scheduled_at: scheduledAt || null,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: 'Failed to create campaign' }, { status: 500 });
    }

    // If sendNow, trigger immediate sending
    if (sendNow && campaign) {
      // Fetch target members
      let membersQuery = supabase
        .from('members')
        .select('id, email, name')
        .eq('site_id', siteId)
        .eq('status', 'active')
        .eq('marketing_opt_in', true)
        .eq('is_archived', false);

      if (targetPackageIds && targetPackageIds.length > 0) {
        membersQuery = membersQuery.in('package_id', targetPackageIds);
      }

      const { data: members } = await membersQuery;
      const recipientCount = members?.length || 0;

      // TODO: Send emails via Resend batch API
      // for (const m of members || []) { await sendCampaignEmail(m.email, subject, bodyText); }

      await supabase
        .from('member_email_campaigns')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          recipient_count: recipientCount,
        })
        .eq('id', campaign.id);
    }

    return NextResponse.json({ campaign });
  } catch (error: any) {
    console.error('Campaign creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
