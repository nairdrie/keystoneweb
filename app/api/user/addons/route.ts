import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/user/addons
 * Return the current user's add-ons (approved + active).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: addons, error } = await supabase
    .from('user_addons')
    .select('id, addon_type, quantity, status, monthly_price, yearly_price, activated_at, notes')
    .eq('user_id', user.id)
    .in('status', ['approved', 'active'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch user add-ons:', error);
    return NextResponse.json({ error: 'Failed to fetch add-ons' }, { status: 500 });
  }

  return NextResponse.json({ addons: addons || [] });
}
