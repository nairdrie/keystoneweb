import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { sendTransferReminderEmail } from '@/lib/email';

/**
 * GET /api/cron/send-transfer-reminders
 *
 * Runs daily at 11 AM Eastern (vercel.json schedule: "0 15 * * *" — 3 PM UTC).
 *
 * Finds site_transfers that were accepted more than 2 days ago where the site
 * is still unpublished and no reminder has been sent yet. Sends the recipient
 * an email with instructions (choose a plan / click publish) and a login link.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.keystoneweb.ca';

  // 2 days ago
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  // Find accepted transfers where:
  //  - accepted_at is older than 2 days
  //  - no reminder has been sent yet
  const { data: transfers, error: queryError } = await supabase
    .from('site_transfers')
    .select('id, site_id, recipient_email, include_domain, accepted_by')
    .eq('status', 'accepted')
    .lt('accepted_at', twoDaysAgo)
    .is('transfer_reminder_sent_at', null);

  if (queryError) {
    console.error('Cron: failed to query accepted transfers:', queryError);
    return NextResponse.json({ error: 'DB query failed' }, { status: 500 });
  }

  const eligible = transfers ?? [];
  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const transfer of eligible) {
    try {
      if (!transfer.recipient_email || !transfer.accepted_by) {
        skipped++;
        continue;
      }

      // Check if the site is still unpublished
      const { data: site } = await supabase
        .from('sites')
        .select('site_slug, is_published')
        .eq('id', transfer.site_id)
        .single();

      if (!site || site.is_published) {
        // Site already published or deleted — skip & mark so we don't check again
        await supabase
          .from('site_transfers')
          .update({ transfer_reminder_sent_at: new Date().toISOString() })
          .eq('id', transfer.id);
        skipped++;
        continue;
      }

      // Check recipient's subscription status
      const { data: subscription } = await supabase
        .from('user_subscriptions')
        .select('subscription_status, subscription_plan')
        .eq('user_id', transfer.accepted_by)
        .single();

      const hasPaidPlan = subscription?.subscription_status === 'active';
      const isPro = hasPaidPlan && !!subscription?.subscription_plan?.toLowerCase().includes('pro');

      // If transfer included a domain, look it up
      let domainName: string | null = null;
      if (transfer.include_domain) {
        const { data: domainPurchase } = await supabase
          .from('domain_purchases')
          .select('domain')
          .eq('site_id', transfer.site_id)
          .limit(1)
          .single();

        domainName = domainPurchase?.domain ?? null;
      }

      const result = await sendTransferReminderEmail({
        recipientEmail: transfer.recipient_email,
        siteName: site.site_slug || 'Your site',
        domainName,
        hasPaidPlan,
        isPro,
        loginUrl: `${appUrl}/login`,
      });

      if (result.success) {
        // Mark reminder as sent
        await supabase
          .from('site_transfers')
          .update({ transfer_reminder_sent_at: new Date().toISOString() })
          .eq('id', transfer.id);
        sent++;
      } else {
        errors++;
      }
    } catch (err) {
      console.error(`Cron: error processing transfer ${transfer.id}:`, err);
      errors++;
    }
  }

  return NextResponse.json({ checked: eligible.length, sent, skipped, errors });
}
