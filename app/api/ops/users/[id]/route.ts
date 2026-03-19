import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { createClient } from '@/lib/db/supabase-server';

async function isAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  
  const adminEmails = (process.env.OPS_ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
    
  return adminEmails.includes(user.email?.toLowerCase() ?? '');
}

/**
 * PATCH /api/ops/users/[id]
 * Update user status (is_banned) or plan
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { is_banned, plan } = body;

  const db = createAdminClient();

  if (typeof is_banned === 'boolean') {
    const { error } = await db
      .from('users')
      .update({ is_banned, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) return NextResponse.json({ error: 'Failed to update ban status' }, { status: 500 });
  }

  if (plan) {
    const { error } = await db
      .from('user_subscriptions')
      .upsert({
        user_id: id,
        subscription_plan: plan,
        subscription_status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
