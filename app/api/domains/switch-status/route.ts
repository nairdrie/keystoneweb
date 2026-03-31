import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

/**
 * GET /api/domains/switch-status
 * Returns whether the user is rate-limited for domain switching (once per month).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: recentSwitch } = await supabase
      .from('domain_purchases')
      .select('id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .eq('is_free_with_pro', false)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentSwitch) {
      const nextAvailable = new Date(new Date(recentSwitch.created_at).getTime() + 30 * 24 * 60 * 60 * 1000);
      return NextResponse.json({
        rateLimited: true,
        nextAvailableAt: nextAvailable.toISOString(),
        nextAvailableFormatted: nextAvailable.toLocaleDateString('en-CA', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }

    return NextResponse.json({ rateLimited: false });
  } catch (error) {
    console.error('Error checking domain switch status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
