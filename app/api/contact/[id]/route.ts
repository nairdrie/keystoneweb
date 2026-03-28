import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';
import { SupabaseClient } from '@supabase/supabase-js';

type Params = { params: Promise<{ id: string }> };

async function getAuthorizedSubmission(id: string, userId: string, supabase: SupabaseClient) {
  const db = createAdminClient();

  // Fetch submission via admin client (bypasses RLS on contact_submissions)
  const { data: submission, error } = await db
    .from('contact_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !submission) return { submission: null, db, error: 'Submission not found' };

  // Verify ownership via auth client (same pattern as working inbox route)
  const { data: site } = await supabase
    .from('sites')
    .select('user_id')
    .eq('id', submission.site_id)
    .single();

  if (!site || site.user_id !== userId) return { submission: null, db, error: 'Forbidden' };

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
  const { submission, error } = await getAuthorizedSubmission(id, user.id, supabase);

  if (!submission) {
    return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 404 });
  }

  return NextResponse.json({ submission });
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
  const { submission, db, error } = await getAuthorizedSubmission(id, user.id, supabase);

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
  const { submission, db, error } = await getAuthorizedSubmission(id, user.id, supabase);

  if (!submission) {
    return NextResponse.json({ error }, { status: error === 'Forbidden' ? 403 : 404 });
  }

  await db.from('contact_submissions').delete().eq('id', id);

  return NextResponse.json({ success: true });
}
