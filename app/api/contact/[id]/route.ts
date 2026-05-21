import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireSiteAccess, siteAccessErrorResponse, SiteAccessDeniedError } from '@/lib/auth/site-access';

type Params = { params: Promise<{ id: string }> };

async function getAuthorizedSubmission(id: string, request: NextRequest) {
  const db = createAdminClient();

  const { data: submission, error } = await db
    .from('contact_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !submission) {
    throw new SiteAccessDeniedError(404, 'Submission not found');
  }

  // requireSiteAccess gates by the site owning the submission.
  await requireSiteAccess(submission.site_id, request);

  return { submission, db };
}

/**
 * GET /api/contact/[id]
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let submission;
  try {
    ({ submission } = await getAuthorizedSubmission(id, req));
  } catch (e) {
    return siteAccessErrorResponse(e);
  }
  return NextResponse.json({ submission });
}

/**
 * PATCH /api/contact/[id]
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  let db;
  try {
    ({ db } = await getAuthorizedSubmission(id, request));
  } catch (e) {
    return siteAccessErrorResponse(e);
  }

  const body = await request.json();
  const allowed = ['spam', 'needs_review', 'new', 'ai_handled', 'replied'];

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    update.status = body.status;
  }
  if (typeof body.is_read === 'boolean') {
    update.is_read = body.is_read;
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  await db
    .from('contact_submissions')
    .update(update)
    .eq('id', id);

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/contact/[id]
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let db;
  try {
    ({ db } = await getAuthorizedSubmission(id, req));
  } catch (e) {
    return siteAccessErrorResponse(e);
  }

  await db.from('contact_submissions').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
