import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/db/supabase-server';

export async function GET(request: NextRequest) {
  const siteId = request.nextUrl.searchParams.get('siteId');

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: site, error } = await supabase
    .from('sites')
    .select('business_profile, design_data, user_id')
    .eq('id', siteId)
    .single();

  if (error || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.user_id && site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json({ 
    businessProfile: site.business_profile || null,
    socialLinks: (site.design_data as any)?.socialLinks || null
  });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { siteId, businessProfile, socialLinks } = body;

  if (!siteId) {
    return NextResponse.json({ error: 'siteId is required' }, { status: 400 });
  }

  // Verify ownership and fetch existing design_data
  const { data: site, error: fetchError } = await supabase
    .from('sites')
    .select('user_id, design_data')
    .eq('id', siteId)
    .single();

  if (fetchError || !site) {
    return NextResponse.json({ error: 'Site not found' }, { status: 404 });
  }

  if (site.user_id && site.user_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Merge socialLinks into existing design_data
  const updatedDesignData = {
    ...(site.design_data as any || {}),
    socialLinks: socialLinks || (site.design_data as any)?.socialLinks || {}
  };

  const { error: updateError } = await supabase
    .from('sites')
    .update({
      business_profile: businessProfile,
      design_data: updatedDesignData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', siteId);

  if (updateError) {
    console.error('Error updating business profile:', updateError);
    return NextResponse.json({ error: 'Failed to save business profile' }, { status: 500 });
  }

  // Track the edit event
  const { trackEvent } = await import('@/lib/analytics');
  trackEvent('site_edit', { userId: user.id, siteId });

  return NextResponse.json({ 
    message: 'Business profile and social links saved', 
    businessProfile, 
    socialLinks 
  });
}
