import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

type Params = { params: Promise<{ id: string }> };

async function getAuthorizedSubmission(id: string, userId: string) {
  const db = createAdminClient();
  const { data: submission, error } = await db
    .from('contact_submissions')
    .select('*, sites(siteSlug, user_id, design_data)')
    .eq('id', id)
    .single();

  if (error || !submission) return { submission: null, db, error: 'Submission not found' };
  const site = (submission as any).sites;
  if (site?.user_id !== userId) return { submission: null, db, error: 'Forbidden' };

  return { submission, db, error: null };
}

/**
 * GET /api/contact/[id]
 * Fetch a single contact submission. Auth: must own the site.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { submission, error } = await getAuthorizedSubmission(id, user.id);

  if (!submission) {
    return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 404 });
  }

  // Strip the joined sites relation from the response
  const { sites: _sites, ...rest } = submission as any;
  return NextResponse.json({ submission: rest });
}

/**
 * PATCH /api/contact/[id]
 * Update submission status. Body: { status: 'spam' | 'needs_review' | 'new' }
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { submission, db, error } = await getAuthorizedSubmission(id, user.id);

  if (!submission) {
    return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 404 });
  }

  const body = await request.json();
  const allowed = ['spam', 'needs_review', 'new', 'ai_handled', 'replied'];
  if (!allowed.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  await db
    .from('contact_submissions')
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ success: true });
}

/**
 * DELETE /api/contact/[id]
 * Permanently delete a submission. Auth: must own the site.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const { submission, db, error } = await getAuthorizedSubmission(id, user.id);

  if (!submission) {
    return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 404 });
  }

  await db.from('contact_submissions').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
