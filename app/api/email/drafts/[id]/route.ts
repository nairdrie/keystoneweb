import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, siteId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: site } = await supabase.from('sites').select('id, user_id').eq('id', siteId).single();
  if (!site || site.user_id !== user.id) return null;
  return user;
}

/**
 * PATCH /api/email/drafts/[id]
 *   → update a compose draft by id
 *   Body: { siteId, addressId?, toEmails?, ccEmails?, bccEmails?, subject?, bodyHtml?, bodyText? }
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const body = await request.json();
  const { siteId, addressId, subject, bodyHtml, bodyText } = body;
  const toEmails: string[] = body.toEmails ?? [];
  const ccEmails: string[] = body.ccEmails ?? [];
  const bccEmails: string[] = body.bccEmails ?? [];

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  if (!await verifyOwner(supabase, siteId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  const { error } = await db
    .from('email_drafts')
    .update({
      address_id: addressId ?? null,
      to_emails: toEmails,
      cc_emails: ccEmails,
      bcc_emails: bccEmails,
      subject: subject ?? null,
      body_html: bodyHtml ?? null,
      body_text: bodyText ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('site_id', siteId)
    .is('thread_id', null);  // only compose drafts via this endpoint

  if (error) {
    console.error('[email/drafts/[id]] patch failed:', error);
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/email/drafts/[id]?siteId=...
 *   → delete any draft by id
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const siteId = request.nextUrl.searchParams.get('siteId');

  if (!siteId) return NextResponse.json({ error: 'siteId required' }, { status: 400 });
  if (!await verifyOwner(supabase, siteId)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createAdminClient();
  await db.from('email_drafts').delete().eq('id', id).eq('site_id', siteId);
  return NextResponse.json({ ok: true });
}
