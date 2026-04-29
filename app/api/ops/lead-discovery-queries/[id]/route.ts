import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { requireOpsAccess } from '@/lib/ops/access';

const REGIONS = new Set(['toronto_core', 'york', 'peel', 'halton', 'durham']);
const UPDATABLE = new Set(['enabled', 'niche', 'city', 'region']);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireOpsAccess();
  if (!access?.isAdmin) {
    return NextResponse.json({ error: 'Admins only' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of Object.keys(body)) {
    if (UPDATABLE.has(key)) update[key] = body[key];
  }

  if (typeof update.region === 'string' && !REGIONS.has(update.region)) {
    return NextResponse.json({ error: 'Invalid region' }, { status: 400 });
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No updatable fields' }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from('lead_discovery_queries')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
