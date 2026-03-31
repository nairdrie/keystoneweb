import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { sendContactReplyEmail } from '@/lib/email';

/**
 * POST /api/contact/[id]/reply
 *
 * Sends a manual reply from the site owner to a contact form submitter.
 * Auth: must be the owner of the site the submission belongs to.
 *
 * Body: { replyText: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { replyText, siteId } = await request.json();

  if (!replyText?.trim()) {
    return NextResponse.json({ error: 'replyText is required' }, { status: 400 });
  }
  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  // Verify ownership via auth client using siteId from the request
  // (same pattern as the working inbox route — auth client + siteId from URL)
  const { data: site } = await supabase
    .from('sites')
    .select('site_slug, user_id, design_data, published_domain')
    .eq('id', siteId)
    .single();

  if (!site || site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = createAdminClient();

  // Fetch submission via admin client (bypasses RLS on contact_submissions)
  // Cross-check that it belongs to the verified site
  const { data: submission, error: fetchErr } = await db
    .from('contact_submissions')
    .select('*')
    .eq('id', id)
    .eq('site_id', siteId)
    .single();

  if (fetchErr || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
  }

  const businessName = site?.site_slug || 'Our Business';

  const result = await sendContactReplyEmail({
    toEmail: submission.sender_email,
    toName: submission.sender_name,
    fromAddress: 'contact@keystoneweb.ca',
    fromName: businessName,
    replyText: replyText.trim(),
    originalMessage: submission.message,
    submissionId: id,
    replyToAddress: site.published_domain ? `${site.published_domain}@kswd.ca` : undefined,
  });

  if (!result.success) {
    console.error('[contact/reply] Failed to send:', result.error);
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 });
  }

  // Update submission record
  await db.from('contact_submissions').update({
    status: 'replied',
    admin_reply: replyText.trim(),
    admin_reply_at: new Date().toISOString(),
    reply_resend_id: (result as any).messageId ?? null,
  }).eq('id', id);

  return NextResponse.json({ success: true });
}
