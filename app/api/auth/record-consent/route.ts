import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tosAccepted, marketingOptIn } = await request.json();

    if (!tosAccepted) {
      return NextResponse.json(
        { error: 'Terms of Service must be accepted' },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error: updateError } = await admin
      .from('users')
      .update({
        tos_accepted_at: new Date().toISOString(),
        marketing_opt_in: !!marketingOptIn,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Record consent error:', updateError);
      return NextResponse.json({ error: 'Failed to record consent' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Record consent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
