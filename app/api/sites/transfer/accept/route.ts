import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';
import { createAdminClient } from '@/lib/db/supabase-admin';
import { trackEvent } from '@/lib/analytics';

// POST - Accept a site transfer
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { token } = await request.json();
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Fetch the transfer
    const { data: transfer, error: fetchError } = await admin
      .from('site_transfers')
      .select('*')
      .eq('token', token)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
    }

    if (transfer.status !== 'pending') {
      return NextResponse.json({ error: 'Transfer is no longer available' }, { status: 410 });
    }

    if (new Date(transfer.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Transfer link has expired' }, { status: 410 });
    }

    // Don't allow transferring to yourself
    if (transfer.from_user_id === user.id) {
      return NextResponse.json({ error: 'You cannot transfer a site to yourself' }, { status: 400 });
    }

    // Transfer ownership: update the site's user_id
    const { error: updateError } = await admin
      .from('sites')
      .update({
        user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transfer.site_id);

    if (updateError) {
      console.error('Error transferring site:', updateError);
      return NextResponse.json({ error: 'Failed to transfer site' }, { status: 500 });
    }

    // Mark the transfer as accepted
    await admin
      .from('site_transfers')
      .update({
        status: 'accepted',
        accepted_by: user.id,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', transfer.id);

    trackEvent('site_transfer_accepted', {
      userId: user.id,
      siteId: transfer.site_id,
      metadata: { fromUserId: transfer.from_user_id },
    });

    return NextResponse.json({
      message: 'Site transferred successfully',
      siteId: transfer.site_id,
    });
  } catch (error) {
    console.error('Error accepting transfer:', error);
    return NextResponse.json({ error: 'Failed to accept transfer' }, { status: 500 });
  }
}
